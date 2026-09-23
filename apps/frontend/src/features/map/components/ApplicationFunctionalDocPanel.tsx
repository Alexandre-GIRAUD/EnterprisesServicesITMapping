import { useEffect, useRef, useState, type ReactNode } from 'react';
import type {
  FunctionalDocPayload,
  FunctionalDocStatus,
  FunctionalDocumentationDto,
} from '@/types/api';
import {
  fetchFunctionalDocumentation,
  generateFunctionalDocumentation,
} from '../api/functionalDocumentationApi';
import { isGitHubLinkedApplication } from '../utils/githubLinkedApplication';

type Props = {
  applicationId: string;
  applicationName?: string | null;
  applicationDescription?: string | null;
};

const POLL_MS = 2500;

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function DocListSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="functional-doc-block">
      <h4 className="functional-doc-block__title">{title}</h4>
      {children}
    </section>
  );
}

function PayloadView({ payload }: { payload: FunctionalDocPayload }) {
  return (
    <div className="functional-doc-body">
      {payload.title ? <h3 className="functional-doc-heading">{payload.title}</h3> : null}
      {payload.summary ? <p className="functional-doc-summary">{payload.summary}</p> : null}

      {payload.business_capabilities?.length > 0 ? (
        <DocListSection title="Business capabilities">
          <ul className="functional-doc-list">
            {payload.business_capabilities.map((item) => (
              <li key={`${item.name}-${item.description}`}>
                <strong>{item.name}</strong>
                {item.description ? ` — ${item.description}` : ''}
              </li>
            ))}
          </ul>
        </DocListSection>
      ) : null}

      {payload.users_and_actors?.length > 0 ? (
        <DocListSection title="Users and actors">
          <ul className="functional-doc-list">
            {payload.users_and_actors.map((item) => (
              <li key={`${item.name}-${item.role}`}>
                <strong>{item.name}</strong>
                {item.role ? ` — ${item.role}` : ''}
              </li>
            ))}
          </ul>
        </DocListSection>
      ) : null}

      {payload.main_flows?.length > 0 ? (
        <DocListSection title="Main flows">
          <ul className="functional-doc-list">
            {payload.main_flows.map((item) => (
              <li key={`${item.name}-${item.description}`}>
                <strong>{item.name}</strong>
                {item.description ? ` — ${item.description}` : ''}
              </li>
            ))}
          </ul>
        </DocListSection>
      ) : null}

      {payload.data_concepts?.length > 0 ? (
        <DocListSection title="Data concepts">
          <ul className="functional-doc-list">
            {payload.data_concepts.map((item) => (
              <li key={`${item.name}-${item.description}`}>
                <strong>{item.name}</strong>
                {item.description ? ` — ${item.description}` : ''}
              </li>
            ))}
          </ul>
        </DocListSection>
      ) : null}

      {payload.integrations_functional?.length > 0 ? (
        <DocListSection title="Functional integrations">
          <ul className="functional-doc-list">
            {payload.integrations_functional.map((item) => (
              <li key={`${item.name}-${item.purpose}`}>
                <strong>{item.name}</strong>
                {item.purpose ? ` — ${item.purpose}` : ''}
              </li>
            ))}
          </ul>
        </DocListSection>
      ) : null}

      {payload.out_of_scope?.length > 0 ? (
        <DocListSection title="Out of scope">
          <ul className="functional-doc-list">
            {payload.out_of_scope.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </DocListSection>
      ) : null}

      {payload.limitations?.length > 0 ? (
        <DocListSection title="Limitations">
          <ul className="functional-doc-list">
            {payload.limitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </DocListSection>
      ) : null}

      {payload.assumptions?.length > 0 ? (
        <DocListSection title="Assumptions">
          <ul className="functional-doc-list">
            {payload.assumptions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </DocListSection>
      ) : null}

      {payload.sources?.length > 0 ? (
        <DocListSection title="Sources">
          <ul className="functional-doc-list functional-doc-list--sources">
            {payload.sources.map((item) => (
              <li key={item}>
                <code>{item}</code>
              </li>
            ))}
          </ul>
        </DocListSection>
      ) : null}
    </div>
  );
}

/**
 * Functional documentation panel shown under the module map after double-click.
 */
export function ApplicationFunctionalDocPanel({
  applicationId,
  applicationName,
  applicationDescription,
}: Props) {
  const githubLinked = isGitHubLinkedApplication({
    name: applicationName,
    description: applicationDescription,
  });
  const [doc, setDoc] = useState<FunctionalDocumentationDto | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function startPolling() {
    stopPolling();
    pollRef.current = setInterval(() => {
      void fetchFunctionalDocumentation(applicationId)
        .then((next) => {
          setDoc(next);
          if (next.status !== 'PENDING') stopPolling();
        })
        .catch(() => {
          /* keep polling until unmount; next tick may succeed */
        });
    }, POLL_MS);
  }

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setErrorMessage(null);
    setDoc(null);
    stopPolling();

    void fetchFunctionalDocumentation(applicationId)
      .then((data) => {
        if (cancelled) return;
        setDoc(data);
        setStatus('ready');
        if (data.status === 'PENDING') startPolling();
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Unable to load documentation.');
      });

    return () => {
      cancelled = true;
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart only when app changes
  }, [applicationId]);

  async function onGenerate() {
    if (!githubLinked || busy) return;
    setBusy(true);
    setErrorMessage(null);
    try {
      const started = await generateFunctionalDocumentation(applicationId);
      setDoc(started);
      setStatus('ready');
      if (started.status === 'PENDING') startPolling();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to start generation.');
    } finally {
      setBusy(false);
    }
  }

  const docStatus: FunctionalDocStatus = doc?.status ?? 'MISSING';
  const canGenerate =
    githubLinked && !busy && docStatus !== 'PENDING' && status !== 'loading';

  return (
    <section className="functional-doc-panel" aria-label="Functional documentation">
      <header className="functional-doc-panel__header">
        <div>
          <h3 className="functional-doc-panel__title">Functional documentation</h3>
          {docStatus === 'READY' && doc?.generatedAt ? (
            <p className="functional-doc-panel__meta">
              Generated from repository
              {doc.sourceRepo ? (
                <>
                  {' '}
                  · <code>{doc.sourceRepo}</code>
                </>
              ) : null}{' '}
              · {formatWhen(doc.generatedAt)}
            </p>
          ) : null}
        </div>
        {githubLinked ? (
          <button
            type="button"
            className="graph-drawer-action graph-drawer-action-primary functional-doc-panel__action"
            disabled={!canGenerate}
            onClick={() => void onGenerate()}
          >
            <span className="graph-drawer-action-title">
              {busy || docStatus === 'PENDING'
                ? 'Generating…'
                : docStatus === 'READY' || docStatus === 'FAILED'
                  ? 'Regenerate'
                  : 'Generate'}
            </span>
          </button>
        ) : null}
      </header>

      {!githubLinked ? (
        <p className="functional-doc-panel__hint">
          Functional documentation is available for GitHub-linked applications only.
        </p>
      ) : null}

      {status === 'loading' ? (
        <p className="functional-doc-panel__hint" role="status">
          Loading documentation…
        </p>
      ) : null}

      {errorMessage ? (
        <p className="graph-drawer-feedback graph-drawer-feedback-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {status === 'ready' && docStatus === 'MISSING' && githubLinked ? (
        <p className="functional-doc-panel__hint">
          No functional documentation yet. Generate it from the README and source.
        </p>
      ) : null}

      {docStatus === 'PENDING' ? (
        <p className="functional-doc-panel__hint" role="status">
          Generating from README and source…
        </p>
      ) : null}

      {docStatus === 'FAILED' ? (
        <p className="graph-drawer-feedback graph-drawer-feedback-error" role="alert">
          {doc?.errorMessage?.trim() || 'Documentation generation failed.'}
        </p>
      ) : null}

      {docStatus === 'READY' && doc?.payload ? <PayloadView payload={doc.payload} /> : null}

      {docStatus === 'READY' && doc?.analyzedFiles?.length ? (
        <details className="functional-doc-analyzed">
          <summary>Analyzed files ({doc.analyzedFiles.length})</summary>
          <ul className="functional-doc-list functional-doc-list--sources">
            {doc.analyzedFiles.map((f) => (
              <li key={f}>
                <code>{f}</code>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ApplicationResponse } from '@/types/api';
import {
  fetchDetectionDocument,
  importThirdPartyFile,
  importThirdPartyText,
  saveDetectionDocumentFile,
  saveDetectionDocumentText,
  suggestConnectionsFromDocument,
  suggestModulesFromDocument,
  type DetectionDocument,
} from '../api/applicationsApi';
import { navigateToModuleGraph } from '../utils/mapNavigation';
import { thirdPartyApplications } from '../utils/thirdPartyApplications';

type ThirdPartySourcesProps = {
  applications: ApplicationResponse[];
  onChanged: () => Promise<void>;
};

export function ThirdPartySources({ applications, onChanged }: ThirdPartySourcesProps) {
  const thirdParty = useMemo(() => thirdPartyApplications(applications), [applications]);
  const applicationIds = useMemo(
    () => thirdParty.map((application) => application.id),
    [thirdParty]
  );
  const [documents, setDocuments] = useState<Record<string, DetectionDocument>>({});
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      applicationIds.map(async (applicationId) => {
        try {
          const document = await fetchDetectionDocument(applicationId);
          return [applicationId, document] as const;
        } catch {
          return [applicationId, emptyDocument()] as const;
        }
      })
    ).then((rows) => {
      if (!cancelled) setDocuments(Object.fromEntries(rows));
    });
    return () => {
      cancelled = true;
    };
  }, [applicationIds]);

  async function onImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setBusy(true);
    try {
      if (file) {
        await importThirdPartyFile(name.trim(), description, title, file);
      } else {
        await importThirdPartyText({
          name: name.trim(),
          description,
          title,
          body,
        });
      }
      setName('');
      setDescription('');
      setTitle('');
      setBody('');
      setFile(null);
      setFormKey((key) => key + 1);
      await onChanged();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to import.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form
        key={formKey}
        className="github-import-token-form"
        onSubmit={(event) => void onImport(event)}
      >
        <label className="github-import-search-label">
          <span className="github-import-search-span">Name</span>
          <input
            className="github-import-search-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            aria-label="Third-party name"
          />
        </label>
        <label className="github-import-search-label">
          <span className="github-import-search-span">Description</span>
          <input
            className="github-import-search-input"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            aria-label="Third-party description"
          />
        </label>
        <label className="github-import-search-label">
          <span className="github-import-search-span">Document title</span>
          <input
            className="github-import-search-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Defaults to the file name"
            aria-label="Document title"
          />
        </label>
        <label className="github-import-search-label">
          <span className="github-import-search-span">Document text</span>
          <textarea
            className="github-import-search-input"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            aria-label="Document text"
          />
        </label>
        <label className="github-import-search-label">
          <span className="github-import-search-span">Or upload .txt, .md, or .pdf</span>
          <input
            className="github-import-search-input"
            type="file"
            accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
            aria-label="Third-party document"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <button
          type="submit"
          className="github-import-primary"
          disabled={busy || name.trim().length === 0 || (!file && body.trim().length === 0)}
        >
          {busy ? 'Importing…' : 'Import third party'}
        </button>
      </form>
      {errorMessage ? (
        <p className="github-import-state github-import-state-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <ul className="github-import-list" aria-label="Third-party applications">
        {thirdParty.map((application) => (
          <ThirdPartyRow
            key={application.id}
            application={application}
            document={documents[application.id]}
            onChanged={onChanged}
          />
        ))}
      </ul>
    </div>
  );
}

function ThirdPartyRow({
  application,
  document,
  onChanged,
}: {
  application: ApplicationResponse;
  document: DetectionDocument | undefined;
  onChanged: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(document?.title ?? '');
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [createdNames, setCreatedNames] = useState<string[]>([]);
  const [skippedNames, setSkippedNames] = useState<string[]>([]);
  const [moduleGraphReady, setModuleGraphReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const saved = (document?.characterCount ?? 0) > 0;
  const dirty = file !== null || body.trim().length > 0 || title !== (document?.title ?? '');
  const modulesLocked = Boolean(application.hasModuleSubtree);

  useEffect(() => {
    setTitle(document?.title ?? '');
  }, [document?.title]);

  async function onReplace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setBusy(true);
    try {
      if (file) {
        await saveDetectionDocumentFile(application.id, file, title);
      } else {
        await saveDetectionDocumentText(application.id, title, body || document?.body || '');
      }
      setBody('');
      setFile(null);
      setFileKey((key) => key + 1);
      await onChanged();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to replace the document.');
    } finally {
      setBusy(false);
    }
  }

  async function onModules() {
    setCreatedNames([]);
    setSkippedNames([]);
    setErrorMessage(null);
    setBusy(true);
    try {
      const result = await suggestModulesFromDocument(application.id);
      setCreatedNames(result.created.map((item) => item.businessName));
      setSkippedNames(skippedLabels(result.skipped));
      setModuleGraphReady(result.created.length > 0);
      await onChanged();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'AI module suggestion failed.');
    } finally {
      setBusy(false);
    }
  }

  async function onConnections() {
    setCreatedNames([]);
    setSkippedNames([]);
    setErrorMessage(null);
    setBusy(true);
    try {
      const result = await suggestConnectionsFromDocument(application.id);
      setCreatedNames(result.created.map((item) => item.peerName));
      setSkippedNames(skippedLabels(result.skipped));
      await onChanged();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'AI connection suggestion failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="github-import-card">
      <div className="github-import-card-body">
        <span className="github-import-card-name">{application.name}</span>
        <span className="github-import-card-desc">
          {saved ? document?.title || 'Documentation' : 'No document'}
        </span>
        <form className="github-import-token-form" onSubmit={(event) => void onReplace(event)}>
          <input
            className="github-import-search-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label={`Document title for ${application.name}`}
          />
          <textarea
            className="github-import-search-input"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            placeholder="Replacement text"
            aria-label={`Document text for ${application.name}`}
          />
          <input
            key={fileKey}
            type="file"
            accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
            aria-label={`Replacement file for ${application.name}`}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <button type="submit" className="github-import-primary" disabled={busy || !dirty}>
            Replace document
          </button>
        </form>
        <div className="github-import-card-ai">
          <button
            type="button"
            className="github-import-ai-btn"
            disabled={!saved || dirty || busy || modulesLocked}
            onClick={() => void onModules()}
          >
            {modulesLocked ? 'Modules already in place' : 'Suggest modules'}
          </button>
          <button
            type="button"
            className="github-import-ai-btn"
            disabled={!saved || dirty || busy}
            onClick={() => void onConnections()}
          >
            Suggest connections
          </button>
          {moduleGraphReady ? (
            <button
              type="button"
              className="github-import-inline-link"
              onClick={() => navigateToModuleGraph(navigate, application.id, application.name)}
            >
              View module graph
            </button>
          ) : null}
        </div>
        <RunList label="Created" names={createdNames} />
        <RunList label="Skipped" names={skippedNames} />
        {errorMessage ? (
          <p className="github-import-state github-import-state-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function emptyDocument(): DetectionDocument {
  return { title: null, body: null, characterCount: 0, updatedAt: null };
}

function skippedLabels(skipped: { detail?: string; reason: string }[]): string[] {
  return skipped.map((item) => item.detail || item.reason).filter(Boolean);
}

function RunList({ label, names }: { label: string; names: string[] }) {
  if (names.length === 0) return null;
  return (
    <div className="github-import-feedback github-import-feedback-success" role="status">
      <p className="github-import-feedback-title">{label}</p>
      <ul className="github-import-feedback-list">
        {names.map((name, index) => (
          <li key={`${label}-${index}`}>{name}</li>
        ))}
      </ul>
    </div>
  );
}

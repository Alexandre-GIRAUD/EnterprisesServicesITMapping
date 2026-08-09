import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ApplicationResponse, ChangeDetectionItemDto, ChangeDetectionRunDto } from '@/types/api';
import { fetchApplications } from '@/features/map/api/applicationsApi';
import {
  acceptChangeDetectionItem,
  getChangeDetection,
  rejectChangeDetectionItem,
} from '@/features/map/api/changeDetectionsApi';
import {
  githubCommitUrl,
  kindChipClass,
  resolveAppName,
  resolveSourceDest,
  shortSha,
} from '@/features/map/utils/changeDetectionUi';
import type { MapLocationState } from '@/features/map/utils/mapNavigation';

export function ChangeDetailPage() {
  const { runId = '', itemId = '' } = useParams<{ runId: string; itemId: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<ChangeDetectionRunDto | null>(null);
  const [applications, setApplications] = useState<ApplicationResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const app of applications) {
      map.set(app.id, app.name);
    }
    return map;
  }, [applications]);

  const item: ChangeDetectionItemDto | null = useMemo(() => {
    if (!run) return null;
    return run.items.find((i) => i.id === itemId) ?? null;
  }, [run, itemId]);

  const load = useCallback(async () => {
    if (!runId) return;
    try {
      setError(null);
      setStatus('loading');
      const [nextRun, apps] = await Promise.all([
        getChangeDetection(runId),
        fetchApplications().catch(() => [] as ApplicationResponse[]),
      ]);
      setRun(nextRun);
      setApplications(apps);
      setStatus('ready');
    } catch (e) {
      setStatus('ready');
      setError(e instanceof Error ? e.message : 'Unable to load change.');
    }
  }, [runId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sourceDest = useMemo(() => {
    if (!run || !item) return null;
    return resolveSourceDest(run, item, nameById);
  }, [run, item, nameById]);

  async function handleAccept() {
    if (!run || !item) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      await acceptChangeDetectionItem(run.id, item.id);
      setFeedback('Accepted. Neo4j suggestion applied.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Accept failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!run || !item) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      await rejectChangeDetectionItem(run.id, item.id);
      setFeedback('Rejected.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reject failed.');
    } finally {
      setBusy(false);
    }
  }

  const backToChangesState: MapLocationState = {
    graphMode: 'normal',
    sideMenuTool: 'changes',
  };

  if (status === 'loading' && !run) {
    return (
      <div className="change-detail-page">
        <p className="change-detail-hint">Loading…</p>
      </div>
    );
  }

  if (!run || !item || !sourceDest) {
    return (
      <div className="change-detail-page">
        <Link to="/map" state={backToChangesState} className="change-detail-back">
          ← Changes
        </Link>
        <p className="change-detail-error" role="alert">
          {error ?? 'Change not found.'}
        </p>
      </div>
    );
  }

  const appName = resolveAppName(run.applicationId, nameById);
  const isPending = item.status === 'PENDING';
  const commitHref = githubCommitUrl(run.repoFullName, run.commitSha);

  return (
    <div className="change-detail-page">
      <div className="change-detail-header">
        <Link to="/map" state={backToChangesState} className="change-detail-back">
          ← Changes
        </Link>
        <div className="change-detail-title-row">
          <span className={kindChipClass(item.kind)}>{item.kind}</span>
          <span className={`change-detail-status change-detail-status--${item.status.toLowerCase()}`}>
            {item.status}
          </span>
        </div>
        <h1 className="change-detail-heading">Review {item.kind}</h1>
        <p className="change-detail-lead">{appName}</p>
      </div>

      {error ? (
        <p className="change-detail-error" role="alert">
          {error}
        </p>
      ) : null}
      {feedback ? <p className="change-detail-feedback">{feedback}</p> : null}

      <section className="change-detail-panel">
        <h2>Description</h2>
        <p className="change-detail-summary">{item.summary}</p>
      </section>

      <section className="change-detail-panel">
        <h2>Nodes</h2>
        <dl className="change-detail-dl">
          <div>
            <dt>Source</dt>
            <dd>
              {sourceDest.source}
              {run.applicationId ? (
                <span className="change-detail-id"> · {run.applicationId}</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt>Destination</dt>
            <dd>
              {sourceDest.dest ??
                'Destination non précisée (suggestion générique)'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="change-detail-panel">
        <h2>Context</h2>
        <dl className="change-detail-dl">
          <div>
            <dt>Repository</dt>
            <dd>{run.repoFullName}</dd>
          </div>
          <div>
            <dt>Commit</dt>
            <dd>
              <a href={commitHref} target="_blank" rel="noreferrer">
                {shortSha(run.commitSha)}
              </a>
            </dd>
          </div>
          <div>
            <dt>Branch</dt>
            <dd>{run.branchRef || '—'}</dd>
          </div>
          {run.buckets.length > 0 ? (
            <div>
              <dt>Buckets</dt>
              <dd>{run.buckets.join(' · ')}</dd>
            </div>
          ) : null}
          <div>
            <dt>Confidence</dt>
            <dd>{Math.round(item.confidence * 100)}%</dd>
          </div>
        </dl>
      </section>

      {item.evidence?.length ? (
        <section className="change-detail-panel">
          <h2>Evidence</h2>
          <ul className="change-detail-evidence">
            {item.evidence.map((ev, idx) => (
              <li key={`${ev.path}-${idx}`}>
                <code>{ev.path}</code>
                {ev.hunkPreview ? (
                  <pre className="change-detail-hunk">{ev.hunkPreview}</pre>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="change-detail-actions">
        {isPending ? (
          <>
            <button
              type="button"
              className="change-detail-accept"
              disabled={busy}
              onClick={() => void handleAccept()}
            >
              Accept
            </button>
            <button
              type="button"
              className="change-detail-reject"
              disabled={busy}
              onClick={() => void handleReject()}
            >
              Reject
            </button>
          </>
        ) : (
          <button
            type="button"
            className="change-detail-reject"
            onClick={() => navigate('/map', { state: backToChangesState })}
          >
            Back to cartography
          </button>
        )}
      </div>
    </div>
  );
}

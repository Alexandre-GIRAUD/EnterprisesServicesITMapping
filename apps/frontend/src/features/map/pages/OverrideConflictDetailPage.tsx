import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { AttributeOverrideConflictDto } from '@/types/api';
import {
  acceptOverrideConflict,
  getOverrideConflict,
  rejectOverrideConflict,
} from '../api/overrideConflictsApi';
import type { MapLocationState } from '../utils/mapNavigation';
import { moduleGraphMapState } from '../utils/mapNavigation';

function dash(value: string | null | undefined): string {
  const t = value?.trim();
  return t ? t : '(empty)';
}

export function OverrideConflictDetailPage() {
  const { conflictId = '' } = useParams<{ conflictId: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<AttributeOverrideConflictDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!conflictId) return;
    try {
      setError(null);
      setStatus('loading');
      setItem(await getOverrideConflict(conflictId));
      setStatus('ready');
    } catch (e) {
      setStatus('ready');
      setError(e instanceof Error ? e.message : 'Unable to load conflict.');
    }
  }, [conflictId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAccept() {
    if (!item) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const updated = await acceptOverrideConflict(item.id);
      setItem(updated);
      setFeedback('Accepted. AI value applied; human override removed.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Accept failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!item) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const updated = await rejectOverrideConflict(item.id);
      setItem(updated);
      setFeedback('Rejected. Human value kept.');
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

  if (status === 'loading' && !item) {
    return (
      <div className="change-detail-page">
        <p className="change-detail-hint">Loading…</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="change-detail-page">
        <Link to="/map" state={backToChangesState} className="change-detail-back">
          ← Changes
        </Link>
        <p className="change-detail-error" role="alert">
          {error ?? 'Conflict not found.'}
        </p>
      </div>
    );
  }

  const mapLink =
    item.targetType === 'APPLICATION'
      ? ({
          pathname: '/map',
          state: moduleGraphMapState(item.targetId),
        } as const)
      : ({ pathname: '/map', state: backToChangesState } as const);

  return (
    <div className="change-detail-page">
      <div className="change-detail-nav">
        <Link to="/admin/changes" className="change-detail-back">
          ← All changes
        </Link>
        <Link to="/map" state={backToChangesState} className="change-detail-back">
          Open in cartography
        </Link>
      </div>

      <header className="change-detail-header">
        <p className="change-detail-eyebrow">Human override conflict</p>
        <h1 className="change-detail-title">{item.fieldKey}</h1>
        <p className="change-detail-meta">
          {item.targetType} · {item.targetId} · {item.fieldScope}
          {item.aiSource ? ` · ${item.aiSource}` : ''}
        </p>
        <span className="change-chip-kind change-chip-kind--override">OVERRIDE</span>{' '}
        <span className="change-detail-status">{item.status}</span>
      </header>

      {error ? (
        <p className="change-detail-error" role="alert">
          {error}
        </p>
      ) : null}
      {feedback ? (
        <p className="change-detail-feedback" role="status">
          {feedback}
        </p>
      ) : null}

      <section className="change-detail-section">
        <h2 className="change-detail-section-title">Values</h2>
        <dl className="change-detail-dl">
          <div>
            <dt>Protected (human)</dt>
            <dd>{dash(item.protectedValue)}</dd>
          </div>
          <div>
            <dt>Proposed (AI)</dt>
            <dd>{dash(item.proposedValue)}</dd>
          </div>
        </dl>
        {item.targetType === 'APPLICATION' ? (
          <p className="change-detail-hint">
            <Link to={mapLink.pathname} state={mapLink.state}>
              Open application on map →
            </Link>
          </p>
        ) : null}
      </section>

      {item.status === 'PENDING' ? (
        <div className="change-detail-actions">
          <button
            type="button"
            className="graph-drawer-action graph-drawer-action-primary"
            disabled={busy}
            onClick={() => void handleAccept()}
          >
            <span className="graph-drawer-action-title">
              {busy ? 'Working…' : 'Accept AI value'}
            </span>
          </button>
          <button
            type="button"
            className="graph-drawer-action"
            disabled={busy}
            onClick={() => void handleReject()}
          >
            <span className="graph-drawer-action-title">Reject</span>
          </button>
          <button
            type="button"
            className="graph-drawer-action"
            disabled={busy}
            onClick={() => navigate('/admin/changes')}
          >
            <span className="graph-drawer-action-title">Back</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

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
        <Link to="/admin/changes" className="changes-list-map-link">
          All changes
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
      <header className="change-detail-header">
        <div>
          <div className="change-detail-title-row">
            <span className="change-chip-kind change-chip-kind--override">Override</span>
            <span className={`change-detail-status change-detail-status--${item.status.toLowerCase()}`}>
              {item.status.charAt(0) + item.status.slice(1).toLowerCase()}
            </span>
          </div>
          <h1 className="change-detail-heading">{item.fieldKey}</h1>
          <p className="change-detail-lead">
            {item.targetType} · {item.fieldScope}
            {item.aiSource ? ` · ${item.aiSource}` : ''}
          </p>
        </div>
        <div className="change-detail-nav">
          <Link to="/admin/changes" className="changes-list-map-link">
            All changes
          </Link>
          <Link to="/map" state={backToChangesState} className="changes-list-map-link">
            Cartography
          </Link>
        </div>
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

      <section className="change-detail-panel">
        <h2>Values</h2>
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
            className="change-detail-accept"
            disabled={busy}
            onClick={() => void handleAccept()}
          >
            {busy ? 'Working…' : 'Accept AI value'}
          </button>
          <button
            type="button"
            className="change-detail-reject"
            disabled={busy}
            onClick={() => void handleReject()}
          >
            Reject
          </button>
          <button
            type="button"
            className="change-detail-reject"
            disabled={busy}
            onClick={() => navigate('/admin/changes')}
          >
            Back
          </button>
        </div>
      ) : null}
    </div>
  );
}

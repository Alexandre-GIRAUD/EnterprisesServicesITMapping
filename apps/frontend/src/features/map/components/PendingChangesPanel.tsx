import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ApplicationResponse, ChangeDetectionRunDto } from '@/types/api';
import { listChangeDetections } from '../api/changeDetectionsApi';
import {
  countPendingItems,
  flattenPendingChips,
  kindChipClass,
} from '../utils/changeDetectionUi';

type PendingChangesPanelProps = {
  variant?: 'page' | 'embedded';
  /** Application catalog to resolve linked node names. */
  applications?: ApplicationResponse[];
  /** Notifies parent of current PENDING item count (for toolbar badge). */
  onPendingCountChange?: (count: number) => void;
};

export function PendingChangesPanel({
  variant = 'embedded',
  applications = [],
  onPendingCountChange,
}: PendingChangesPanelProps) {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<ChangeDetectionRunDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready'>('idle');

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const app of applications) {
      map.set(app.id, app.name);
    }
    return map;
  }, [applications]);

  const pendingCount = useMemo(() => countPendingItems(runs), [runs]);
  const chips = useMemo(() => flattenPendingChips(runs, nameById), [runs, nameById]);

  const reload = useCallback(async () => {
    try {
      setError(null);
      setStatus('loading');
      const next = await listChangeDetections();
      setRuns(next);
      setStatus('ready');
      onPendingCountChange?.(countPendingItems(next));
    } catch (e) {
      setStatus('ready');
      setError(e instanceof Error ? e.message : 'Unable to load changes.');
    }
  }, [onPendingCountChange]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const rootClass =
    variant === 'embedded'
      ? 'pending-changes-panel pending-changes-panel--embedded'
      : 'pending-changes-panel';

  return (
    <section className={rootClass} aria-label="Pending changes">
      <div className="pending-changes-panel-header">
        <h2 className="pending-changes-panel-title">
          Changes
          {pendingCount > 0 ? (
            <span className="pending-changes-panel-badge">{pendingCount}</span>
          ) : null}
        </h2>
        <button
          type="button"
          className="graph-filter-compact-btn"
          onClick={() => void reload()}
          disabled={status === 'loading'}
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p className="pending-changes-panel-error" role="alert">
          {error}
        </p>
      ) : null}

      {status === 'loading' && chips.length === 0 ? (
        <p className="pending-changes-panel-hint">Loading…</p>
      ) : chips.length === 0 ? (
        <p className="pending-changes-panel-hint">No pending changes.</p>
      ) : (
        <ul className="pending-changes-chip-list">
          {chips.map((chip) => (
            <li key={`${chip.runId}:${chip.itemId}`}>
              <button
                type="button"
                className="pending-changes-chip"
                aria-label={chip.ariaLabel}
                onClick={() =>
                  navigate(`/admin/changes/${chip.runId}/${chip.itemId}`)
                }
              >
                <span className={kindChipClass(chip.kind)}>{chip.kind}</span>
                <span className="pending-changes-chip-body">
                  <span className="pending-changes-chip-nodes">{chip.nodesLabel}</span>
                  <span className="pending-changes-chip-meta">{chip.meta}</span>
                </span>
                <span className="pending-changes-chip-chevron" aria-hidden>
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function pendingItemsCount(runs: ChangeDetectionRunDto[]): number {
  return countPendingItems(runs);
}

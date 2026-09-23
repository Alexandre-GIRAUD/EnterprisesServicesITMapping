import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  ApplicationResponse,
  AttributeOverrideConflictDto,
  ChangeDetectionRunDto,
} from '@/types/api';
import { listChangeDetections } from '../api/changeDetectionsApi';
import { listOverrideConflicts } from '../api/overrideConflictsApi';
import {
  countPendingItems,
  flattenPendingChips,
  kindChipClass,
} from '../utils/changeDetectionUi';

type FamilyFilter = 'all' | 'github' | 'override';

type PendingChangesPanelProps = {
  variant?: 'page' | 'embedded';
  /** Application catalog to resolve linked node names. */
  applications?: ApplicationResponse[];
  /** Notifies parent of current PENDING item count (for toolbar badge). */
  onPendingCountChange?: (count: number) => void;
};

function dash(value: string | null | undefined): string {
  const t = value?.trim();
  return t ? t : '(empty)';
}

function overrideChipClass(scope: AttributeOverrideConflictDto['fieldScope']): string {
  return scope === 'EDGE_ATTR'
    ? 'change-chip-kind change-chip-kind--override change-chip-kind--edge-attr'
    : 'change-chip-kind change-chip-kind--override change-chip-kind--node-attr';
}

export function PendingChangesPanel({
  variant = 'embedded',
  applications = [],
  onPendingCountChange,
}: PendingChangesPanelProps) {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<ChangeDetectionRunDto[]>([]);
  const [overrides, setOverrides] = useState<AttributeOverrideConflictDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [family, setFamily] = useState<FamilyFilter>('all');

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const app of applications) {
      map.set(app.id, app.name);
    }
    return map;
  }, [applications]);

  const githubChips = useMemo(() => flattenPendingChips(runs, nameById), [runs, nameById]);
  const githubPending = useMemo(() => countPendingItems(runs), [runs]);
  const overridePending = overrides.length;
  const pendingCount = githubPending + overridePending;

  const showGithub = family === 'all' || family === 'github';
  const showOverride = family === 'all' || family === 'override';

  const reload = useCallback(async () => {
    try {
      setError(null);
      setStatus('loading');
      const [nextRuns, overridePage] = await Promise.all([
        listChangeDetections(),
        listOverrideConflicts({ status: 'PENDING', page: 0, size: 50 }),
      ]);
      setRuns(nextRuns);
      setOverrides(overridePage.items);
      setStatus('ready');
      onPendingCountChange?.(countPendingItems(nextRuns) + overridePage.items.length);
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

  const empty =
    (showGithub ? githubChips.length === 0 : true) &&
    (showOverride ? overrides.length === 0 : true);

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

      <div className="pending-changes-family-chips" role="group" aria-label="Change family">
        {(
          [
            ['all', 'All'],
            ['github', 'GitHub'],
            ['override', 'Human override'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={
              family === id
                ? 'pending-changes-family-chip pending-changes-family-chip--active'
                : 'pending-changes-family-chip'
            }
            aria-pressed={family === id}
            onClick={() => setFamily(id)}
          >
            {label}
            {id === 'github' && githubPending > 0 ? ` (${githubPending})` : ''}
            {id === 'override' && overridePending > 0 ? ` (${overridePending})` : ''}
          </button>
        ))}
      </div>

      {error ? (
        <p className="pending-changes-panel-error" role="alert">
          {error}
        </p>
      ) : null}

      {status === 'loading' && empty ? (
        <p className="pending-changes-panel-hint">Loading…</p>
      ) : empty ? (
        <p className="pending-changes-panel-hint">No pending changes.</p>
      ) : (
        <>
          {showGithub && githubChips.length > 0 ? (
            <div className="pending-changes-section">
              <h3 className="pending-changes-section-title">GitHub webhook</h3>
              <ul className="pending-changes-chip-list">
                {githubChips.map((chip) => (
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
            </div>
          ) : null}

          {showOverride && overrides.length > 0 ? (
            <div className="pending-changes-section">
              <h3 className="pending-changes-section-title">Human override</h3>
              <ul className="pending-changes-chip-list">
                {overrides.map((item) => {
                  const targetName =
                    item.targetType === 'APPLICATION'
                      ? (nameById.get(item.targetId) ?? item.targetId.slice(0, 8))
                      : item.targetId.slice(0, 12);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="pending-changes-chip"
                        aria-label={`Review override conflict on ${item.fieldKey}`}
                        onClick={() => navigate(`/admin/changes/overrides/${item.id}`)}
                      >
                        <span className={overrideChipClass(item.fieldScope)}>OVERRIDE</span>
                        <span className="pending-changes-chip-body">
                          <span className="pending-changes-chip-nodes">
                            {targetName} · {item.fieldKey}
                          </span>
                          <span className="pending-changes-chip-meta">
                            {dash(item.protectedValue)} → {dash(item.proposedValue)}
                            {item.aiSource ? ` · ${item.aiSource}` : ''}
                          </span>
                        </span>
                        <span className="pending-changes-chip-chevron" aria-hidden>
                          ›
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

export function pendingItemsCount(runs: ChangeDetectionRunDto[]): number {
  return countPendingItems(runs);
}

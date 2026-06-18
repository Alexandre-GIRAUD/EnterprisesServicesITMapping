import { useCallback, useEffect, useState } from 'react';
import { deleteGraphSnapshot, listGraphSnapshots } from '../api/graphSnapshotsApi';
import { useGraphSnapshotsRefresh } from '../context/GraphSnapshotsContext';
import type { GraphSnapshotDto, GraphSnapshotFilters } from '@/types/api';

type GraphViewsPanelProps = {
  onApply: (filters: GraphSnapshotFilters) => void;
};

export function GraphViewsPanel({ onApply }: GraphViewsPanelProps) {
  const { version } = useGraphSnapshotsRefresh();
  const [snapshots, setSnapshots] = useState<GraphSnapshotDto[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSnapshots = useCallback(async () => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const data = await listGraphSnapshots();
      setSnapshots(data);
      setStatus('ready');
    } catch (e) {
      setStatus('error');
      setErrorMessage(e instanceof Error ? e.message : 'Unable to load views.');
    }
  }, []);

  useEffect(() => {
    void loadSnapshots();
  }, [version, loadSnapshots]);

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete view "${name}"?`)) return;
    try {
      await deleteGraphSnapshot(id);
      setSnapshots((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Unable to delete.');
    }
  }

  function handleApply(snapshot: GraphSnapshotDto) {
    onApply(snapshot.filters);
  }

  return (
    <div
      id="graph-views-pane"
      className="graph-views-pane"
      role="tabpanel"
      aria-labelledby="graph-mode-tab-views"
    >
      <header className="graph-views-pane-header">
        <h2 className="graph-views-pane-title">My views</h2>
        <p className="graph-views-pane-subtitle">
          Pinned filter sets from Information System Explorer. Select a view to apply it to the graph.
        </p>
      </header>

      {status === 'loading' ? (
        <p className="graph-views-state" role="status">
          Loading…
        </p>
      ) : status === 'error' ? (
        <p className="graph-views-state graph-views-state-error" role="alert">
          {errorMessage}
        </p>
      ) : snapshots.length === 0 ? (
        <p className="graph-views-state">No saved views yet. Pin a filter set from Information System Explorer.</p>
      ) : (
        <ul className="graph-views-list" aria-label="Saved views">
          {snapshots.map((snapshot) => (
            <li key={snapshot.id} className="graph-views-item">
              <button
                type="button"
                className="graph-views-item-btn"
                onClick={() => handleApply(snapshot)}
              >
                <span className="graph-views-item-name">{snapshot.name}</span>
                <span className="graph-views-item-hint">Apply to graph</span>
              </button>
              <button
                type="button"
                className="graph-views-item-delete"
                aria-label={`Delete ${snapshot.name}`}
                onClick={() => void handleDelete(snapshot.id, snapshot.name)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

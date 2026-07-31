import { useGraphSnapshotsList } from '../hooks/useGraphSnapshotsList';
import type { GraphSnapshotDto, GraphSnapshotFilters } from '@/types/api';

type GraphViewsPanelProps = {
  onApply: (filters: GraphSnapshotFilters) => void;
};

export function GraphViewsPanel({ onApply }: GraphViewsPanelProps) {
  const { snapshots, status, errorMessage, deleteSnapshot } = useGraphSnapshotsList();

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
        <p className="graph-views-state">No saved views yet. Pin a view from Production.</p>
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
                onClick={() => void deleteSnapshot(snapshot.id, snapshot.name)}
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

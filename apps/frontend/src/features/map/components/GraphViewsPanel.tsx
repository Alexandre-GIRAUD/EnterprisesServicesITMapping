import { useState } from 'react';
import { useGraphSnapshotsList } from '../hooks/useGraphSnapshotsList';
import type { GraphSnapshotDto, GraphSnapshotFilters } from '@/types/api';

type GraphViewsPanelProps = {
  onApply: (filters: GraphSnapshotFilters) => void;
};

export function GraphViewsPanel({ onApply }: GraphViewsPanelProps) {
  const { snapshots, status, errorMessage, renameSnapshot, deleteSnapshot } = useGraphSnapshotsList();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  function startRename(snapshot: GraphSnapshotDto) {
    setEditingId(snapshot.id);
    setDraftName(snapshot.name);
  }

  function cancelRename() {
    setEditingId(null);
    setDraftName('');
  }

  async function commitRename(snapshot: GraphSnapshotDto) {
    const nextName = draftName.trim();
    if (!nextName || nextName === snapshot.name) {
      cancelRename();
      return;
    }
    try {
      await renameSnapshot(snapshot.id, nextName);
      cancelRename();
    } catch {
      // The list hook surfaces the message. Keep the field open.
    }
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
          {errorMessage ? (
            <li className="graph-views-state graph-views-state-error" role="alert">
              {errorMessage}
            </li>
          ) : null}
          {snapshots.map((snapshot) => (
            <li key={snapshot.id} className="graph-views-item">
              <div className="graph-views-item-btn">
                {editingId === snapshot.id ? (
                  <input
                    className="graph-views-item-name-input"
                    aria-label={`Rename ${snapshot.name}`}
                    value={draftName}
                    autoFocus
                    onChange={(event) => setDraftName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void commitRename(snapshot);
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        cancelRename();
                      }
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="graph-views-item-name"
                    onClick={() => startRename(snapshot)}
                  >
                    {snapshot.name}
                  </button>
                )}
                <button
                  type="button"
                  className="graph-views-item-hint"
                  onClick={() => onApply(snapshot.filters)}
                >
                  Apply to graph
                </button>
              </div>
              <button
                type="button"
                className="graph-views-item-rename"
                aria-label={`Rename ${snapshot.name}`}
                title="Rename"
                onClick={() => startRename(snapshot)}
              >
                <PencilIcon />
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

function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        d="M12.2 4.2 L15.8 7.8 L8.2 15.4 H4.6 V11.8 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10.6 5.8 L14.2 9.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

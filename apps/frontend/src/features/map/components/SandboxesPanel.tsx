import { useState } from 'react';
import {
  MAX_OPEN_SANDBOXES,
  sandboxLayoutsForCount,
  type SandboxLayoutMode,
  type SavedSandboxMeta,
} from '../utils/sandboxDocuments';

type SandboxesPanelProps = {
  openSandboxCount: number;
  layoutMode: SandboxLayoutMode;
  onLayoutModeChange: (mode: SandboxLayoutMode) => void;
  onNewSandbox: () => void;
  onSaveActive: () => void;
  canSave: boolean;
  savedSandboxes: SavedSandboxMeta[];
  onLoadSandbox: (id: string) => void;
  onDeleteSavedSandbox: (id: string) => void;
};

const LAYOUT_LABELS: Record<SandboxLayoutMode, string> = {
  horizontal: 'Horizontal',
  vertical: 'Vertical',
  square: 'Square',
  'main-side': 'Main + side',
  'top-row': 'Top + row',
};

function LayoutGlyph({ mode }: { mode: SandboxLayoutMode }) {
  const common = {
    fill: 'currentColor',
    opacity: 0.85,
    rx: 0.6,
  } as const;
  if (mode === 'horizontal') {
    return (
      <svg viewBox="0 0 20 14" width="22" height="16" aria-hidden="true">
        <rect x="1" y="2" width="8" height="10" {...common} />
        <rect x="11" y="2" width="8" height="10" {...common} />
      </svg>
    );
  }
  if (mode === 'vertical') {
    return (
      <svg viewBox="0 0 20 14" width="22" height="16" aria-hidden="true">
        <rect x="2" y="1" width="16" height="5" {...common} />
        <rect x="2" y="8" width="16" height="5" {...common} />
      </svg>
    );
  }
  if (mode === 'square') {
    return (
      <svg viewBox="0 0 20 14" width="22" height="16" aria-hidden="true">
        <rect x="1" y="1" width="8" height="5.5" {...common} />
        <rect x="11" y="1" width="8" height="5.5" {...common} />
        <rect x="1" y="7.5" width="8" height="5.5" {...common} />
        <rect x="11" y="7.5" width="8" height="5.5" {...common} />
      </svg>
    );
  }
  if (mode === 'main-side') {
    return (
      <svg viewBox="0 0 20 14" width="22" height="16" aria-hidden="true">
        <rect x="1" y="1" width="10" height="12" {...common} />
        <rect x="12.5" y="1" width="6.5" height="5.5" {...common} />
        <rect x="12.5" y="7.5" width="6.5" height="5.5" {...common} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 14" width="22" height="16" aria-hidden="true">
      <rect x="1" y="1" width="18" height="5" {...common} />
      <rect x="1" y="7.5" width="5.5" height="5.5" {...common} />
      <rect x="7.25" y="7.5" width="5.5" height="5.5" {...common} />
      <rect x="13.5" y="7.5" width="5.5" height="5.5" {...common} />
    </svg>
  );
}

/** Manage open sandboxes, save/load, and layout icons. */
export function SandboxesPanel({
  openSandboxCount,
  layoutMode,
  onLayoutModeChange,
  onNewSandbox,
  onSaveActive,
  canSave,
  savedSandboxes,
  onLoadSandbox,
  onDeleteSavedSandbox,
}: SandboxesPanelProps) {
  const [selectedSavedId, setSelectedSavedId] = useState('');
  const layouts = sandboxLayoutsForCount(openSandboxCount);
  const activeLayout =
    layouts.includes(layoutMode) || layouts.length === 0 ? layoutMode : layouts[0];

  return (
    <div className="graph-drawer-sandbox-manage">
      <div className="sandbox-manage-top">
        <p className="graph-drawer-search-state" role="status">
          Sandboxes {openSandboxCount}/{MAX_OPEN_SANDBOXES}
        </p>
        {layouts.length > 0 ? (
          <div className="sandbox-layout-picker" role="group" aria-label="Layout">
            {layouts.map((mode) => (
              <button
                key={mode}
                type="button"
                className={`sandbox-layout-picker__btn${activeLayout === mode ? ' is-active' : ''}`}
                aria-label={LAYOUT_LABELS[mode]}
                aria-pressed={activeLayout === mode}
                title={LAYOUT_LABELS[mode]}
                onClick={() => onLayoutModeChange(mode)}
              >
                <LayoutGlyph mode={mode} />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="sandbox-manage-actions">
        <button
          type="button"
          className="graph-drawer-action"
          disabled={openSandboxCount >= MAX_OPEN_SANDBOXES}
          onClick={onNewSandbox}
        >
          <span className="graph-drawer-action-title">New</span>
        </button>
        <button
          type="button"
          className="graph-drawer-action"
          disabled={!canSave}
          onClick={onSaveActive}
        >
          <span className="graph-drawer-action-title">Save</span>
        </button>
        <button
          type="button"
          className="graph-drawer-action"
          disabled={!selectedSavedId}
          onClick={() => selectedSavedId && onLoadSandbox(selectedSavedId)}
        >
          <span className="graph-drawer-action-title">Load</span>
        </button>
      </div>

      {savedSandboxes.length === 0 ? (
        <p className="graph-drawer-search-state">No saved sandboxes.</p>
      ) : (
        <>
          <select
            className="graph-drawer-input"
            value={selectedSavedId}
            onChange={(e) => setSelectedSavedId(e.target.value)}
            aria-label="Saved sandboxes"
          >
            <option value="">Saved sandboxes…</option>
            {savedSandboxes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {selectedSavedId ? (
            <button
              type="button"
              className="graph-drawer-action"
              onClick={() => {
                onDeleteSavedSandbox(selectedSavedId);
                setSelectedSavedId('');
              }}
            >
              <span className="graph-drawer-action-title">Delete</span>
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

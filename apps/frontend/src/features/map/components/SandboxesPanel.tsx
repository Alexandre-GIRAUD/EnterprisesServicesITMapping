import { useState } from 'react';
import {
  MAX_OPEN_SANDBOXES,
  sandboxLayoutsForCount,
  type SandboxLayoutMode,
  type SavedSandboxMeta,
} from '../utils/sandboxDocuments';

type OpenSandbox = { id: string; name: string; dirty: boolean };

type SandboxesPanelProps = {
  openSandboxes: OpenSandbox[];
  activeSandboxId: string | null;
  onFocusOpen: (id: string) => void;
  layoutMode: SandboxLayoutMode;
  onLayoutModeChange: (mode: SandboxLayoutMode) => void;
  onNewSandbox: () => void;
  onSaveActive: () => void;
  canSave: boolean;
  savedSandboxes: SavedSandboxMeta[];
  onLoadSandbox: (id: string) => void;
  onDeleteSavedSandbox: (id: string) => void;
  onShareSavedSandbox: (id: string, username: string) => Promise<void>;
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
  openSandboxes,
  activeSandboxId,
  onFocusOpen,
  layoutMode,
  onLayoutModeChange,
  onNewSandbox,
  onSaveActive,
  canSave,
  savedSandboxes,
  onLoadSandbox,
  onDeleteSavedSandbox,
  onShareSavedSandbox,
}: SandboxesPanelProps) {
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [draftUsername, setDraftUsername] = useState('');
  const openSandboxCount = openSandboxes.length;
  const layouts = sandboxLayoutsForCount(openSandboxCount);
  const activeLayout =
    layouts.includes(layoutMode) || layouts.length === 0 ? layoutMode : layouts[0];

  async function shareSelected(id: string) {
    const username = draftUsername.trim();
    if (!username) return;
    try {
      await onShareSavedSandbox(id, username);
      setDraftUsername('');
      setSharingId(null);
    } catch {
      // The caller reports the failure.
    }
  }

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
          className="sandbox-manage-chip"
          disabled={openSandboxCount >= MAX_OPEN_SANDBOXES}
          onClick={onNewSandbox}
        >
          New
        </button>
        <button type="button" className="sandbox-manage-chip" disabled={!canSave} onClick={onSaveActive}>
          Save
        </button>
      </div>

      <p className="sandbox-manage-section">Open</p>
      {openSandboxes.length === 0 ? (
        <p className="graph-drawer-search-state">No sandbox open.</p>
      ) : (
        <ul className="graph-drawer-saved-list" aria-label="Open sandboxes">
          {openSandboxes.map((sandbox) => (
            <li key={sandbox.id}>
              <button
                type="button"
                className={`sandbox-manage-open${sandbox.id === activeSandboxId ? ' is-active' : ''}`}
                onClick={() => onFocusOpen(sandbox.id)}
              >
                <span className="graph-drawer-saved-name">
                  {sandbox.name}
                  {sandbox.dirty ? ' •' : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="sandbox-manage-section">Saved</p>
      {savedSandboxes.length === 0 ? (
        <p className="graph-drawer-search-state">No saved sandboxes.</p>
      ) : (
        <ul className="graph-drawer-saved-list" aria-label="Saved sandboxes">
          {savedSandboxes.map((sandbox) => (
            <li key={sandbox.id} className="sandbox-manage-saved">
              <div className="graph-drawer-saved-item">
                <span className="graph-drawer-saved-name">{sandbox.name}</span>
                <button type="button" className="sandbox-manage-mini" onClick={() => onLoadSandbox(sandbox.id)}>
                  Load
                </button>
                <button
                  type="button"
                  className="sandbox-manage-mini"
                  onClick={() => {
                    setSharingId(sharingId === sandbox.id ? null : sandbox.id);
                    setDraftUsername('');
                  }}
                >
                  Share
                </button>
                <button
                  type="button"
                  className="sandbox-manage-mini sandbox-manage-mini--danger"
                  onClick={() => {
                    if (sharingId === sandbox.id) setSharingId(null);
                    onDeleteSavedSandbox(sandbox.id);
                  }}
                >
                  Delete
                </button>
              </div>
              {sharingId === sandbox.id ? (
                <div className="sandbox-manage-load-row">
                  <input
                    className="graph-drawer-input"
                    aria-label={`Username to receive ${sandbox.name}`}
                    placeholder="Username"
                    value={draftUsername}
                    autoFocus
                    onChange={(event) => setDraftUsername(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        setSharingId(null);
                      }
                      if (event.key !== 'Enter') return;
                      event.preventDefault();
                      void shareSelected(sandbox.id);
                    }}
                  />
                  <button
                    type="button"
                    className="sandbox-manage-mini"
                    disabled={!draftUsername.trim()}
                    onClick={() => void shareSelected(sandbox.id)}
                  >
                    Send
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

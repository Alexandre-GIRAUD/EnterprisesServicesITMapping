import { useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import {
  MAX_OPEN_SANDBOXES,
  sandboxLayoutsForCount,
  type SandboxLayoutMode,
  type SavedSandboxMeta,
} from '../utils/sandboxDocuments';
import {
  SANDBOX_MENU_DELETE,
  SANDBOX_MENU_MOVE,
  SANDBOX_MENU_NEW_FOLDER,
  SANDBOX_MENU_RENAME,
  SANDBOX_ROOT_DESTINATION,
  deleteSandboxFolderTree,
  listSandboxMenuEntries,
  listSandboxMoveDestinations,
  type SandboxFolder,
} from '../utils/sandboxFolders';
import { parentFolderId } from '../utils/viewFolderRules';

type OpenSandbox = { id: string; name: string; dirty: boolean };

type SandboxesPanelProps = {
  openSandboxes: OpenSandbox[];
  activeSandboxId: string | null;
  onFocusOpen: (id: string) => void;
  layoutMode: SandboxLayoutMode;
  onLayoutModeChange: (mode: SandboxLayoutMode) => void;
  onNewSandbox: () => void;
  onSaveSandbox: (id: string) => void;
  onDuplicateSandbox: (id: string) => void;
  onCloseSandbox: (id: string) => void;
  savedSandboxes: SavedSandboxMeta[];
  sandboxFolders: SandboxFolder[];
  onLoadSandbox: (id: string) => void;
  onDeleteSavedSandbox: (id: string) => void;
  onCreateSandboxFolder: (parentId: string | null) => void;
  onRenameSandboxFolder: (id: string, name: string) => void;
  onDeleteSandboxFolder: (id: string) => void;
  onMoveSandboxFolder: (id: string, parentId: string | null) => void;
  onRenameSavedSandbox: (id: string, name: string) => void;
  onMoveSavedSandbox: (id: string, folderId: string | null) => void;
  onShareSandbox: (id: string, username: string) => Promise<void>;
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
  onSaveSandbox,
  onDuplicateSandbox,
  onCloseSandbox,
  savedSandboxes,
  sandboxFolders,
  onLoadSandbox,
  onDeleteSavedSandbox,
  onCreateSandboxFolder,
  onRenameSandboxFolder,
  onDeleteSandboxFolder,
  onMoveSandboxFolder,
  onRenameSavedSandbox,
  onMoveSavedSandbox,
  onShareSandbox,
}: SandboxesPanelProps) {
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [draftUsername, setDraftUsername] = useState('');
  const openSandboxCount = openSandboxes.length;
  const layouts = sandboxLayoutsForCount(openSandboxCount);
  const activeLayout =
    layouts.includes(layoutMode) || layouts.length === 0 ? layoutMode : layouts[0];

  async function shareSandbox(id: string) {
    const username = draftUsername.trim();
    if (!username) return;
    try {
      await onShareSandbox(id, username);
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
          {openSandboxCount} of {MAX_OPEN_SANDBOXES}
        </p>
        <button
          type="button"
          className="sandbox-manage-new"
          disabled={openSandboxCount >= MAX_OPEN_SANDBOXES}
          onClick={onNewSandbox}
        >
          New
        </button>
      </div>
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

      {openSandboxes.length === 0 ? (
        <p className="graph-drawer-search-state">No sandbox open.</p>
      ) : (
        <ul className="graph-drawer-saved-list" aria-label="Open sandboxes">
          {openSandboxes.map((sandbox) => (
            <li key={sandbox.id}>
              <div className="sandbox-open-row">
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
                <button type="button" className="sandbox-manage-mini" onClick={() => onSaveSandbox(sandbox.id)}>
                  Save
                </button>
                <button type="button" className="sandbox-manage-mini" onClick={() => onDuplicateSandbox(sandbox.id)}>
                  Duplicate
                </button>
                <button
                  type="button"
                  className="sandbox-manage-mini"
                  aria-expanded={sharingId === sandbox.id}
                  onClick={() => {
                    setSharingId((current) => (current === sandbox.id ? null : sandbox.id));
                    setDraftUsername('');
                  }}
                >
                  Share
                </button>
                <button type="button" className="sandbox-manage-mini sandbox-manage-mini--danger" onClick={() => onCloseSandbox(sandbox.id)}>
                  Close
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
                      void shareSandbox(sandbox.id);
                    }}
                  />
                  <button
                    type="button"
                    className="sandbox-manage-mini"
                    disabled={!draftUsername.trim()}
                    onClick={() => void shareSandbox(sandbox.id)}
                  >
                    Send
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <SavedSandboxLibrary
        savedSandboxes={savedSandboxes}
        folders={sandboxFolders}
        onLoadSandbox={onLoadSandbox}
        onDeleteSavedSandbox={onDeleteSavedSandbox}
        onCreateFolder={onCreateSandboxFolder}
        onRenameFolder={onRenameSandboxFolder}
        onDeleteFolder={onDeleteSandboxFolder}
        onMoveFolder={onMoveSandboxFolder}
        onRenameSaved={onRenameSavedSandbox}
        onMoveSaved={onMoveSavedSandbox}
      />
    </div>
  );
}

type SavedMenu = {
  x: number;
  y: number;
  target: 'empty' | 'sandbox' | 'folder';
  id: string | null;
  name: string;
};

type SavedTarget = { kind: 'sandbox' | 'folder'; id: string };

function SavedSandboxLibrary({
  savedSandboxes,
  folders,
  onLoadSandbox,
  onDeleteSavedSandbox,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveFolder,
  onRenameSaved,
  onMoveSaved,
}: {
  savedSandboxes: SavedSandboxMeta[];
  folders: SandboxFolder[];
  onLoadSandbox: (id: string) => void;
  onDeleteSavedSandbox: (id: string) => void;
  onCreateFolder: (parentId: string | null) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onMoveFolder: (id: string, parentId: string | null) => void;
  onRenameSaved: (id: string, name: string) => void;
  onMoveSaved: (id: string, folderId: string | null) => void;
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [isPointerInside, setIsPointerInside] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [menu, setMenu] = useState<SavedMenu | null>(null);
  const [editing, setEditing] = useState<SavedTarget | null>(null);
  const [draftName, setDraftName] = useState('');
  const [moving, setMoving] = useState<SavedTarget | null>(null);
  const openFolderId = folders.some((folder) => folder.id === currentFolderId) ? currentFolderId : null;
  const isListOpen = isPointerInside || menu != null || editing != null || moving != null;
  const filed = savedSandboxes.map((sandbox) => ({
    id: sandbox.id,
    folderId: sandbox.folderId ?? null,
    name: sandbox.name,
  }));
  const childFolders = folders
    .filter((folder) => folder.parentId === openFolderId)
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
  const childSandboxes = savedSandboxes
    .filter((sandbox) => (sandbox.folderId ?? null) === openFolderId)
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));

  function openMenu(event: ReactMouseEvent, next: Omit<SavedMenu, 'x' | 'y'>) {
    event.preventDefault();
    event.stopPropagation();
    const bounds = sectionRef.current?.getBoundingClientRect();
    setMenu({
      ...next,
      x: event.clientX - (bounds?.left ?? 0),
      y: event.clientY - (bounds?.top ?? 0),
    });
  }

  function commitRename(target: SavedTarget) {
    if (target.kind === 'folder') onRenameFolder(target.id, draftName);
    else onRenameSaved(target.id, draftName);
    setEditing(null);
  }

  function removeFolder(folder: SandboxFolder) {
    const removed = deleteSandboxFolderTree({ folders, sandboxes: filed }, folder.id);
    const nested = Math.max(0, folders.length - removed.folders.length - 1);
    const message = `Delete folder "${folder.name}" and its contents (${removed.sandboxIds.length} sandboxes, ${nested} folders)?`;
    if (!window.confirm(message)) return;
    onDeleteFolder(folder.id);
    if (openFolderId === folder.id) setCurrentFolderId(folder.parentId);
  }

  return (
    <section
      ref={sectionRef}
      className="sandbox-saved"
      onMouseEnter={() => setIsPointerInside(true)}
      onMouseLeave={() => setIsPointerInside(false)}
      onContextMenu={(event) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest('.sandbox-saved-row, .sandbox-saved-bar')) return;
        openMenu(event, { target: 'empty', id: null, name: '' });
      }}
    >
      <div className="sandbox-saved-bar">
        <p className="sandbox-manage-section">Saved</p>
        <button type="button" className="sandbox-saved-new" onClick={() => onCreateFolder(openFolderId)}>
          New folder
        </button>
      </div>
      {isListOpen ? (
        <div className="sandbox-saved-reveal">
          {openFolderId ? (
            <button
              type="button"
              className="sandbox-saved-back"
              aria-label="Back"
              onClick={() => setCurrentFolderId(parentFolderId(folders, openFolderId))}
            >
              <BackArrow />
            </button>
          ) : null}
          {childFolders.length === 0 && childSandboxes.length === 0 ? (
            <p className="graph-drawer-search-state">
              {openFolderId ? 'This folder is empty.' : 'No saved sandboxes.'}
            </p>
          ) : (
            <ul className="graph-drawer-saved-list" aria-label="Saved sandboxes">
              {childFolders.map((folder) => (
                <li key={folder.id}>
                  <div
                    className="sandbox-saved-row"
                    role={editing?.kind === 'folder' && editing.id === folder.id ? undefined : 'button'}
                    tabIndex={editing?.kind === 'folder' && editing.id === folder.id ? undefined : 0}
                    onClick={() => {
                      if (editing?.kind === 'folder' && editing.id === folder.id) return;
                      setCurrentFolderId(folder.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      setCurrentFolderId(folder.id);
                    }}
                    onContextMenu={(event) => openMenu(event, { target: 'folder', id: folder.id, name: folder.name })}
                  >
                    {editing?.kind === 'folder' && editing.id === folder.id ? (
                      <RenameField
                        name={folder.name}
                        value={draftName}
                        onChange={setDraftName}
                        onCommit={() => commitRename({ kind: 'folder', id: folder.id })}
                        onCancel={() => setEditing(null)}
                      />
                    ) : (
                      <span className="graph-drawer-saved-name">{folder.name}</span>
                    )}
                  </div>
                  {moving?.kind === 'folder' && moving.id === folder.id ? (
                    <MoveField
                      kind="folder"
                      id={folder.id}
                      folders={folders}
                      filed={filed}
                      onMove={(parentId) => {
                        onMoveFolder(folder.id, parentId);
                        setMoving(null);
                      }}
                    />
                  ) : null}
                </li>
              ))}
              {childSandboxes.map((sandbox) => (
                <li key={sandbox.id} className="sandbox-manage-saved">
                  <div
                    className="sandbox-saved-row graph-drawer-saved-item"
                    onContextMenu={(event) => openMenu(event, { target: 'sandbox', id: sandbox.id, name: sandbox.name })}
                  >
                    {editing?.kind === 'sandbox' && editing.id === sandbox.id ? (
                      <RenameField
                        name={sandbox.name}
                        value={draftName}
                        onChange={setDraftName}
                        onCommit={() => commitRename({ kind: 'sandbox', id: sandbox.id })}
                        onCancel={() => setEditing(null)}
                      />
                    ) : (
                      <span className="graph-drawer-saved-name">{sandbox.name}</span>
                    )}
                    <button type="button" className="sandbox-manage-mini" onClick={() => onLoadSandbox(sandbox.id)}>
                      Load
                    </button>
                    <button
                      type="button"
                      className="sandbox-manage-mini sandbox-manage-mini--danger"
                      onClick={() => onDeleteSavedSandbox(sandbox.id)}
                    >
                      Delete
                    </button>
                  </div>
                  {moving?.kind === 'sandbox' && moving.id === sandbox.id ? (
                    <MoveField
                      kind="sandbox"
                      id={sandbox.id}
                      folders={folders}
                      filed={filed}
                      onMove={(folderId) => {
                        onMoveSaved(sandbox.id, folderId);
                        setMoving(null);
                      }}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      {menu ? (
        <div className="sandbox-saved-menu" role="menu" style={{ left: menu.x, top: menu.y }}>
          {listSandboxMenuEntries(menu.target).map((label) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              onClick={() => {
                const target = menu;
                setMenu(null);
                runSavedMenu(label, target, {
                  openFolderId,
                  folders,
                  onCreateFolder,
                  onDeleteSavedSandbox,
                  removeFolder,
                  startRename: (item) => {
                    setDraftName(item.name);
                    setEditing(item);
                  },
                  startMove: setMoving,
                });
              }}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function runSavedMenu(
  label: string,
  menu: SavedMenu,
  actions: {
    openFolderId: string | null;
    folders: SandboxFolder[];
    onCreateFolder: (parentId: string | null) => void;
    onDeleteSavedSandbox: (id: string) => void;
    removeFolder: (folder: SandboxFolder) => void;
    startRename: (item: SavedTarget & { name: string }) => void;
    startMove: (item: SavedTarget) => void;
  },
) {
  if (label === SANDBOX_MENU_NEW_FOLDER) {
    const parentId = menu.target === 'folder' && menu.id ? menu.id : actions.openFolderId;
    actions.onCreateFolder(parentId);
    return;
  }
  if (!menu.id) return;
  const item = { kind: menu.target === 'folder' ? 'folder' as const : 'sandbox' as const, id: menu.id };
  if (label === SANDBOX_MENU_RENAME) actions.startRename({ ...item, name: menu.name });
  if (label === SANDBOX_MENU_MOVE) actions.startMove(item);
  if (label === SANDBOX_MENU_DELETE && menu.target === 'sandbox') actions.onDeleteSavedSandbox(menu.id);
  if (label === SANDBOX_MENU_DELETE && menu.target === 'folder') {
    const folder = actions.folders.find((entry) => entry.id === menu.id);
    if (folder) actions.removeFolder(folder);
  }
}

function RenameField({
  name,
  value,
  onChange,
  onCommit,
  onCancel,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  return (
    <input
      className="graph-drawer-input"
      aria-label={`Rename ${name}`}
      value={value}
      autoFocus
      onChange={(event) => onChange(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onCommit();
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
        }
      }}
    />
  );
}

function MoveField({
  kind,
  id,
  folders,
  filed,
  onMove,
}: {
  kind: 'sandbox' | 'folder';
  id: string;
  folders: SandboxFolder[];
  filed: { id: string; folderId: string | null; name: string }[];
  onMove: (parentId: string | null) => void;
}) {
  const destinations = listSandboxMoveDestinations({ folders, sandboxes: filed }, { kind, id });
  return (
    <select
      className="graph-views-move"
      aria-label="Choose a destination folder"
      defaultValue=""
      onChange={(event) => {
        const value = event.target.value;
        if (!value) return;
        onMove(value === SANDBOX_ROOT_DESTINATION ? null : value);
      }}
    >
      <option value="">Move to…</option>
      {destinations.map((destination) => (
        <option key={destination.id} value={destination.id}>
          {destination.label}
        </option>
      ))}
    </select>
  );
}

function BackArrow() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="M10 3.5 5.5 8 10 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

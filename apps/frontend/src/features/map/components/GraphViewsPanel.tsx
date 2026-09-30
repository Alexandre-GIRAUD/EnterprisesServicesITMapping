import { useMemo, useState } from 'react';
import { useGraphSnapshotsList } from '../hooks/useGraphSnapshotsList';
import type { GraphSnapshotDto, GraphSnapshotFilters, GraphViewFolderDto } from '@/types/api';
import {
  canCreateIn,
  canMoveFolder,
  descendantFolderIds,
  nameTaken,
  nextFolderName,
  type FolderNode,
  type ViewName,
} from '../utils/viewFolderRules';

type GraphViewsPanelProps = {
  onApply: (filters: GraphSnapshotFilters) => void;
};

type DragItem = { kind: 'view' | 'folder'; id: string };

export function GraphViewsPanel({ onApply }: GraphViewsPanelProps) {
  const library = useGraphSnapshotsList();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [editing, setEditing] = useState<DragItem | null>(null);
  const [draftName, setDraftName] = useState('');
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [dropParentId, setDropParentId] = useState<string | 'root' | null>(null);
  const [moving, setMoving] = useState<DragItem | null>(null);
  const [sharing, setSharing] = useState<DragItem | null>(null);
  const [draftUsername, setDraftUsername] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const folderNodes = useMemo<FolderNode[]>(
    () => library.folders.map((folder) => ({ id: folder.id, parentId: folder.parentId, name: folder.name })),
    [library.folders],
  );
  const viewNames = useMemo<ViewName[]>(
    () => library.snapshots.map((view) => ({ id: view.id, folderId: view.folderId ?? null, name: view.name })),
    [library.snapshots],
  );

  const path = useMemo(() => breadcrumb(library.folders, currentFolderId), [library.folders, currentFolderId]);
  const childFolders = library.folders
    .filter((folder) => folder.parentId === currentFolderId)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const childViews = library.snapshots
    .filter((view) => (view.folderId ?? null) === currentFolderId)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const rows = [
    ...childFolders.map((folder) => ({ kind: 'folder' as const, id: folder.id, name: folder.name, folder })),
    ...childViews.map((view) => ({ kind: 'view' as const, id: view.id, name: view.name, view })),
  ].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  function startRename(item: DragItem, name: string) {
    setEditing(item);
    setDraftName(name);
  }

  async function commitRename(item: DragItem, currentName: string) {
    const nextName = draftName.trim();
    setEditing(null);
    if (!nextName || nextName === currentName) return;
    try {
      if (item.kind === 'view') await library.renameSnapshot(item.id, nextName);
      else await library.renameFolder(item.id, nextName);
    } catch {
      setEditing(item);
      setDraftName(nextName);
    }
  }

  async function commitShare(item: DragItem) {
    const username = draftUsername.trim();
    if (!username) return;
    try {
      if (item.kind === 'view') await library.shareSnapshot(item.id, username);
      else await library.shareFolder(item.id, username);
      setSharing(null);
      setDraftUsername('');
      setNotice(`Shared with ${username}.`);
    } catch {
      // The hook surfaces the message.
    }
  }

  async function place(item: DragItem, parentId: string | null) {
    if (!canDrop(item, parentId, folderNodes, viewNames, library.folders, library.snapshots)) {
      library.setErrorMessage('That item cannot be placed there.');
      return;
    }
    try {
      if (item.kind === 'view') await library.moveSnapshot(item.id, parentId);
      else await library.moveFolder(item.id, parentId);
      setMoving(null);
    } catch {
      // The hook surfaces the message.
    }
  }

  function confirmDeleteFolder(folder: GraphViewFolderDto) {
    const nested = descendantFolderIds(folderNodes, folder.id).length;
    const inside = new Set([folder.id, ...descendantFolderIds(folderNodes, folder.id)]);
    const viewCount = viewNames.filter((view) => view.folderId != null && inside.has(view.folderId)).length;
    if (!window.confirm(`Delete folder "${folder.name}" and its contents (${viewCount} views, ${nested} folders)?`)) {
      return;
    }
    void library.deleteFolder(folder.id).then(() => {
      if (currentFolderId === folder.id || (currentFolderId != null && inside.has(currentFolderId))) {
        setCurrentFolderId(folder.parentId);
      }
    }).catch(() => undefined);
  }

  if (library.status === 'loading') {
    return <p className="graph-views-state" role="status">Loading…</p>;
  }
  if (library.status === 'error') {
    return <p className="graph-views-state graph-views-state-error" role="alert">{library.errorMessage}</p>;
  }

  return (
    <div id="graph-views-pane" className="graph-views-pane" role="tabpanel" aria-labelledby="graph-mode-tab-views">
      <header className="graph-views-pane-header">
        <h2 className="graph-views-pane-title">My views</h2>
        <nav className="graph-views-crumbs" aria-label="Folder path">
          <button
            type="button"
            className={`graph-views-crumb${dropParentId === 'root' ? ' is-drop-target' : ''}`}
            onClick={() => setCurrentFolderId(null)}
            onDragOver={(event) => {
              if (!dragItem || !canDrop(dragItem, null, folderNodes, viewNames, library.folders, library.snapshots)) return;
              event.preventDefault();
              setDropParentId('root');
            }}
            onDragLeave={() => setDropParentId(null)}
            onDrop={(event) => {
              event.preventDefault();
              if (dragItem) void place(dragItem, null);
              setDragItem(null);
              setDropParentId(null);
            }}
          >
            My views
          </button>
          {path.map((folder) => (
            <button
              key={folder.id}
              type="button"
              className="graph-views-crumb"
              onClick={() => setCurrentFolderId(folder.id)}
            >
              {folder.name}
            </button>
          ))}
        </nav>
        <button
          type="button"
          className="graph-views-new"
          disabled={!canCreateIn(folderNodes, currentFolderId)}
          onClick={() => {
            void library.createFolder(nextFolderName(folderNodes, viewNames, currentFolderId), currentFolderId).catch(() => undefined);
          }}
        >
          New folder
        </button>
      </header>
      {library.errorMessage ? (
        <p className="graph-views-state graph-views-state-error" role="alert">{library.errorMessage}</p>
      ) : notice ? (
        <p className="graph-views-state" role="status">{notice}</p>
      ) : null}
      {rows.length === 0 ? (
        <p className="graph-views-state">{currentFolderId ? 'This folder is empty.' : 'No saved views yet. Pin a view from Production.'}</p>
      ) : (
        <ul className="graph-views-list" aria-label="Saved views">
          {rows.map((row) => {
            const item: DragItem = { kind: row.kind, id: row.id };
            const isEditing = editing?.kind === row.kind && editing.id === row.id;
            return (
              <li
                key={`${row.kind}-${row.id}`}
                className={`graph-views-item${dropParentId === row.id ? ' is-drop-target' : ''}`}
                draggable={!isEditing}
                onDragStart={() => setDragItem(item)}
                onDragEnd={() => {
                  setDragItem(null);
                  setDropParentId(null);
                }}
                onDragOver={(event) => {
                  if (row.kind !== 'folder' || !dragItem) return;
                  if (!canDrop(dragItem, row.id, folderNodes, viewNames, library.folders, library.snapshots)) return;
                  event.preventDefault();
                  setDropParentId(row.id);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (row.kind === 'folder' && dragItem) void place(dragItem, row.id);
                  setDragItem(null);
                  setDropParentId(null);
                }}
              >
                <div className="graph-views-item-btn">
                  {isEditing ? (
                    <input
                      className="graph-views-item-name-input"
                      aria-label={`Rename ${row.name}`}
                      value={draftName}
                      autoFocus
                      onChange={(event) => setDraftName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void commitRename(item, row.name);
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          setEditing(null);
                        }
                      }}
                    />
                  ) : (
                    <button type="button" className="graph-views-item-name" onClick={() => startRename(item, row.name)}>
                      {row.name}
                    </button>
                  )}
                  {row.kind === 'view' && row.view ? (
                    <button type="button" className="graph-views-item-hint" onClick={() => onApply(row.view.filters)}>
                      Apply to graph
                    </button>
                  ) : (
                    <button type="button" className="graph-views-item-hint" onClick={() => setCurrentFolderId(row.id)}>
                      Open
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  className="graph-views-item-rename"
                  aria-label={`Rename ${row.name}`}
                  title="Rename"
                  onClick={() => startRename(item, row.name)}
                >
                  <PencilIcon />
                </button>
                <button
                  type="button"
                  className="graph-views-item-rename"
                  aria-label={`Move ${row.name}`}
                  title="Move to…"
                  onClick={() => setMoving(moving?.id === row.id && moving.kind === row.kind ? null : item)}
                >
                  Move
                </button>
                <button
                  type="button"
                  className="graph-views-item-rename"
                  aria-label={`Share ${row.name}`}
                  title="Share a copy"
                  onClick={() => {
                    setMoving(null);
                    setSharing(sharing?.id === row.id && sharing.kind === row.kind ? null : item);
                    setDraftUsername('');
                    setNotice(null);
                  }}
                >
                  Share
                </button>
                <button
                  type="button"
                  className="graph-views-item-delete"
                  aria-label={`Delete ${row.name}`}
                  onClick={() => {
                    if (row.kind === 'view') {
                      if (window.confirm(`Delete view "${row.name}"?`)) void library.deleteSnapshot(row.id);
                      return;
                    }
                    if (row.folder) confirmDeleteFolder(row.folder);
                  }}
                >
                  ×
                </button>
                {moving?.kind === row.kind && moving.id === row.id ? (
                  <MoveSelect
                    item={item}
                    folders={library.folders}
                    folderNodes={folderNodes}
                    viewNames={viewNames}
                    snapshots={library.snapshots}
                    onMove={(parentId) => void place(item, parentId)}
                  />
                ) : null}
                {sharing?.kind === row.kind && sharing.id === row.id ? (
                  <input
                    className="graph-views-item-name-input"
                    aria-label={`Username to receive ${row.name}`}
                    placeholder="Username"
                    value={draftUsername}
                    autoFocus
                    onChange={(event) => setDraftUsername(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void commitShare(item);
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        setSharing(null);
                      }
                    }}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function MoveSelect({
  item,
  folders,
  folderNodes,
  viewNames,
  snapshots,
  onMove,
}: {
  item: DragItem;
  folders: GraphViewFolderDto[];
  folderNodes: FolderNode[];
  viewNames: ViewName[];
  snapshots: GraphSnapshotDto[];
  onMove: (parentId: string | null) => void;
}) {
  const destinations = folderDestinations(item, folders, folderNodes, viewNames, snapshots);
  return (
    <select
      className="graph-views-move"
      aria-label="Choose a destination folder"
      defaultValue=""
      onChange={(event) => {
        const value = event.target.value;
        if (!value) return;
        onMove(value === 'root' ? null : value);
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

function folderDestinations(
  item: DragItem,
  folders: GraphViewFolderDto[],
  folderNodes: FolderNode[],
  viewNames: ViewName[],
  snapshots: GraphSnapshotDto[],
) {
  const options: { id: string; label: string }[] = [];
  if (canDrop(item, null, folderNodes, viewNames, folders, snapshots)) {
    options.push({ id: 'root', label: 'My views' });
  }
  const ordered = [...folders].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  for (const folder of ordered) {
    if (!canDrop(item, folder.id, folderNodes, viewNames, folders, snapshots)) continue;
    options.push({ id: folder.id, label: folderLabel(folders, folder.id) });
  }
  return options;
}

function folderLabel(folders: GraphViewFolderDto[], folderId: string): string {
  const names: string[] = [];
  let current = folders.find((folder) => folder.id === folderId);
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    names.push(current.name);
    current = current.parentId ? folders.find((folder) => folder.id === current?.parentId) : undefined;
  }
  return names.reverse().join(' / ');
}

function canDrop(
  item: DragItem,
  parentId: string | null,
  folders: FolderNode[],
  views: ViewName[],
  folderDtos: GraphViewFolderDto[],
  snapshots: GraphSnapshotDto[],
): boolean {
  if (item.kind === 'folder') {
    const folder = folderDtos.find((entry) => entry.id === item.id);
    if (!folder || folder.parentId === parentId) return false;
    return canMoveFolder(folders, item.id, parentId) && !nameTaken(folders, views, parentId, folder.name, item.id, null);
  }
  const view = snapshots.find((entry) => entry.id === item.id);
  if (!view || (view.folderId ?? null) === parentId) return false;
  return !nameTaken(folders, views, parentId, view.name, null, item.id);
}

function breadcrumb(folders: GraphViewFolderDto[], currentFolderId: string | null): GraphViewFolderDto[] {
  const path: GraphViewFolderDto[] = [];
  let current = currentFolderId ? folders.find((folder) => folder.id === currentFolderId) : undefined;
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.push(current);
    current = current.parentId ? folders.find((folder) => folder.id === current?.parentId) : undefined;
  }
  return path.reverse();
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
      <path d="M10.6 5.8 L14.2 9.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

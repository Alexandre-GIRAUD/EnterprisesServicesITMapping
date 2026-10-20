import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type MutableRefObject, type ReactNode } from 'react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useGraphSnapshotsList } from '../hooks/useGraphSnapshotsList';
import type { GraphSnapshotDto, GraphSnapshotFilters, GraphViewFolderDto } from '@/types/api';
import {
  folderParentForNewFolder,
  savedViewActivation,
  VIEW_MENU_DELETE,
  VIEW_MENU_MOVE,
  VIEW_MENU_NEW_FOLDER,
  VIEW_MENU_RENAME,
  VIEW_MENU_SHARE,
  viewMenuEntries,
  type ViewMenuTarget,
} from '../utils/viewContextMenu';
import {
  canCreateIn,
  canMoveFolder,
  descendantFolderIds,
  nameTaken,
  nextFolderName,
  type FolderNode,
  type ViewName,
} from '../utils/viewFolderRules';
import { storedViewLayout, VIEW_LAYOUT_STORAGE_KEY, type ViewLayout } from '../utils/viewLayout';
import {
  activeFilterCount,
  filterHintLines,
  flattenLibrary,
  folderBreadcrumb,
  folderItemCount,
  searchLibrary,
  viewSummaryLine,
  viewWhenLine,
  type LibraryFolder,
  type LibraryRow,
  type LibrarySortKey,
  type LibraryView,
} from '../utils/viewLibrary';

type GraphViewsPanelProps = {
  onApply: (filters: GraphSnapshotFilters, viewName: string) => void;
  onShownView: (view: InspectedView | null, pin: boolean) => void;
  actionsRef: MutableRefObject<ViewLibraryActions | null>;
};

export type InspectedView = {
  id: string;
  name: string;
  summary: string;
  whenLine: string;
  hints: string[];
};

export type ViewLibraryActions = {
  apply: (id: string) => void;
  rename: (id: string) => void;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
};

type DragItem = { kind: 'view' | 'folder'; id: string };

type ViewContextMenu = {
  x: number;
  y: number;
  target: ViewMenuTarget;
  item: DragItem | null;
  name: string;
};

const SORT_COLUMNS: { key: LibrarySortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'filters', label: 'Filters' },
  { key: 'modified', label: 'Modified' },
  { key: 'author', label: 'Author' },
];

export function GraphViewsPanel({ onApply, onShownView, actionsRef }: GraphViewsPanelProps) {
  const library = useGraphSnapshotsList();
  const { user } = useAuth();
  const authorName = user?.username ?? 'you';
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [editing, setEditing] = useState<DragItem | null>(null);
  const [draftName, setDraftName] = useState('');
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [dropParentId, setDropParentId] = useState<string | null>(null);
  const [moving, setMoving] = useState<DragItem | null>(null);
  const [sharing, setSharing] = useState<DragItem | null>(null);
  const [menu, setMenu] = useState<DragItem | null>(null);
  const [contextMenu, setContextMenu] = useState<ViewContextMenu | null>(null);
  const [draftUsername, setDraftUsername] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [layout, setLayout] = useState<ViewLayout>(() => readStoredViewLayout());
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<LibrarySortKey>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menu) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenu(null);
    }
    function onPointer(event: MouseEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      setMenu(null);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [menu]);

  useEffect(() => {
    if (!contextMenu) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setContextMenu(null);
    }
    function onPointer(event: MouseEvent) {
      if (contextMenuRef.current?.contains(event.target as Node)) return;
      setContextMenu(null);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [contextMenu]);

  const folderNodes = useMemo<FolderNode[]>(
    () => library.folders.map((folder) => ({ id: folder.id, parentId: folder.parentId, name: folder.name })),
    [library.folders],
  );
  const viewNames = useMemo<ViewName[]>(
    () => library.snapshots.map((view) => ({ id: view.id, folderId: view.folderId ?? null, name: view.name })),
    [library.snapshots],
  );
  const libraryFolders = useMemo<LibraryFolder[]>(
    () => library.folders.map((folder) => ({
      id: folder.id,
      parentId: folder.parentId,
      name: folder.name,
      updatedAt: folder.updatedAt,
    })),
    [library.folders],
  );
  const libraryViews = useMemo<LibraryView[]>(
    () => library.snapshots.map((view) => ({
      id: view.id,
      folderId: view.folderId ?? null,
      name: view.name,
      updatedAt: view.updatedAt,
      filters: view.filters,
    })),
    [library.snapshots],
  );

  const crumbs = folderBreadcrumb(libraryFolders, currentFolderId);
  const childFolders = library.folders
    .filter((folder) => folder.parentId === currentFolderId)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const childViews = library.snapshots
    .filter((view) => (view.folderId ?? null) === currentFolderId)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const listedRows = query.trim()
    ? searchLibrary(query, libraryFolders, libraryViews, sortKey, sortDirection, authorName)
    : flattenLibrary(libraryFolders, libraryViews, currentFolderId, expandedIds, sortKey, sortDirection, authorName);

  function startRename(item: DragItem, name: string) {
    setMenu(null);
    setContextMenu(null);
    setMoving(null);
    setSharing(null);
    setEditing(item);
    setDraftName(name);
  }

  function createFolderIn(parentId: string | null) {
    if (!canCreateIn(folderNodes, parentId)) return;
    void library.createFolder(nextFolderName(folderNodes, viewNames, parentId), parentId).catch((error: unknown) => {
      library.setErrorMessage(error instanceof Error ? error.message : 'Unable to create the folder.');
    });
  }

  function openContextMenu(event: ReactMouseEvent, nextMenu: { target: ViewMenuTarget; item: DragItem | null; name: string }) {
    event.preventDefault();
    event.stopPropagation();
    setMenu(null);
    setContextMenu({ x: event.clientX, y: event.clientY, ...nextMenu });
  }

  function newFolderParent(target: ViewMenuTarget, itemId: string | null): string | null {
    return folderParentForNewFolder(target, target === 'folder' ? itemId : null, currentFolderId);
  }

  function runRowAction(label: string, row: { target: ViewMenuTarget; item: DragItem | null; name: string }) {
    if (label === VIEW_MENU_NEW_FOLDER) {
      createFolderIn(newFolderParent(row.target, row.item?.id ?? null));
      return;
    }
    if (!row.item) return;
    if (label === VIEW_MENU_RENAME) startRename(row.item, row.name);
    if (label === VIEW_MENU_MOVE) startMove(row.item);
    if (label === VIEW_MENU_SHARE) startShare(row.item);
    if (label === VIEW_MENU_DELETE) {
      const folder = library.folders.find((entry) => entry.id === row.item?.id);
      deleteRow({ kind: row.item.kind, id: row.item.id, name: row.name, folder });
    }
  }

  function menuButtons(
    row: { target: ViewMenuTarget; item: DragItem | null; name: string },
    closeMenu: () => void,
  ) {
    return viewMenuEntries(row.target).map((label) => {
      const isNewFolderBlocked =
        label === VIEW_MENU_NEW_FOLDER && !canCreateIn(folderNodes, newFolderParent(row.target, row.item?.id ?? null));
      return (
        <button
          key={label}
          type="button"
          role="menuitem"
          className={label === VIEW_MENU_DELETE ? 'quiet-danger' : undefined}
          disabled={isNewFolderBlocked}
          onClick={() => {
            closeMenu();
            runRowAction(label, row);
          }}
        >
          {label}
        </button>
      );
    });
  }

  function startMove(item: DragItem) {
    setMenu(null);
    setSharing(null);
    setMoving(item);
  }

  function startShare(item: DragItem) {
    setMenu(null);
    setMoving(null);
    setSharing(item);
    setDraftUsername('');
    setNotice(null);
  }

  function deleteRow(row: { kind: 'view' | 'folder'; id: string; name: string; folder?: GraphViewFolderDto }) {
    setMenu(null);
    if (row.kind === 'view') {
      if (window.confirm(`Delete view "${row.name}"?`)) {
        void library.deleteSnapshot(row.id);
        if (selectedViewId === row.id) {
          setSelectedViewId(null);
          onShownView(null, true);
        }
      }
      return;
    }
    if (row.folder) confirmDeleteFolder(row.folder);
  }

  function applyView(id: string) {
    const view = library.snapshots.find((entry) => entry.id === id);
    if (!view) return;
    onApply(view.filters, view.name);
  }

  function duplicateView(id: string) {
    const view = library.snapshots.find((entry) => entry.id === id);
    if (!view) return;
    void library.duplicateSnapshot(view).catch((error: unknown) => {
      library.setErrorMessage(error instanceof Error ? error.message : 'Unable to duplicate the view.');
    });
  }

  actionsRef.current = {
    apply: applyView,
    rename: (id) => {
      const view = library.snapshots.find((entry) => entry.id === id);
      if (view) startRename({ kind: 'view', id }, view.name);
    },
    duplicate: duplicateView,
    remove: (id) => {
      const view = library.snapshots.find((entry) => entry.id === id);
      if (view) deleteRow({ kind: 'view', id, name: view.name });
    },
  };

  function showView(view: GraphSnapshotDto, pin: boolean) {
    if (pin) setSelectedViewId(view.id);
    onShownView(inspectedFrom(view, authorName), pin);
  }

  function enterFolder(folderId: string) {
    setCurrentFolderId(folderId);
    setQuery('');
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

  function chooseLayout(next: ViewLayout) {
    setLayout(next);
    localStorage.setItem(VIEW_LAYOUT_STORAGE_KEY, next);
  }

  function toggleSort(key: LibrarySortKey) {
    if (sortKey === key) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('asc');
  }

  function toggleExpanded(folderId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  if (library.status === 'loading') {
    return <p className="graph-views-state" role="status">Loading…</p>;
  }
  if (library.status === 'error') {
    return <p className="graph-views-state graph-views-state-error" role="alert">{library.errorMessage}</p>;
  }

  const isSearching = query.trim().length > 0;
  const folderCards = isSearching
    ? listedRows.filter((row) => row.kind === 'folder')
    : childFolders.map((folder) => folderCardRow(folder, libraryFolders, libraryViews, authorName));
  const viewCards = isSearching
    ? listedRows.filter((row) => row.kind === 'view')
    : childViews.map((view) => viewCardRow(view, libraryFolders, authorName));

  return (
    <div
      id="graph-views-pane"
      className="graph-views-pane"
      role="tabpanel"
      aria-labelledby="graph-mode-tab-views"
      onContextMenu={(event) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest('.graph-views-toolbar')) return;
        openContextMenu(event, { target: 'empty', item: null, name: '' });
      }}
    >
      <div className="graph-views-toolbar">
        <label className="graph-views-search">
          <span className="visually-hidden">Search views</span>
          <input
            value={query}
            placeholder="Search all views"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="graph-views-toolbar-actions">
          <button
            type="button"
            className="graph-views-new"
            disabled={!canCreateIn(folderNodes, currentFolderId)}
            onClick={() => createFolderIn(currentFolderId)}
          >
            New folder
          </button>
          <button
            type="button"
            className="graph-views-layout"
            title="Grid"
            aria-label="Show as squares"
            aria-pressed={layout === 'grid'}
            onClick={() => chooseLayout('grid')}
          >
            <GridGlyph />
          </button>
          <button
            type="button"
            className="graph-views-layout"
            title="List"
            aria-label="Show as a list"
            aria-pressed={layout === 'list'}
            onClick={() => chooseLayout('list')}
          >
            <ListGlyph />
          </button>
        </div>
      </div>
      <nav className="graph-views-crumbs" aria-label="View folders">
        {crumbs.map((crumb, index) => (
          <span key={crumb.id ?? 'root'} className="graph-views-crumb">
            {index > 0 ? <span aria-hidden="true">›</span> : null}
            <button
              type="button"
              aria-current={crumb.id === currentFolderId ? 'page' : undefined}
              onClick={() => {
                setCurrentFolderId(crumb.id);
                setQuery('');
              }}
            >
              {crumb.label}
            </button>
          </span>
        ))}
      </nav>
      {library.errorMessage ? (
        <p className="graph-views-state graph-views-state-error" role="alert">{library.errorMessage}</p>
      ) : notice ? (
        <p className="graph-views-state" role="status">{notice}</p>
      ) : null}
      {layout === 'grid' ? (
        <div className="graph-views-sections">
          {folderCards.length > 0 ? (
            <section aria-label="Folders">
              <h3>Folders</h3>
              <ul className="graph-views-folders">
                {folderCards.map((row) => (
                  <FolderCard
                    key={row.id}
                    row={row}
                    showPath={isSearching}
                    isDropTarget={dropParentId === row.id}
                    isEditing={editing?.kind === 'folder' && editing.id === row.id}
                    draftName={draftName}
                    onDraftName={setDraftName}
                    onCommitRename={() => void commitRename({ kind: 'folder', id: row.id }, row.name)}
                    onCancelRename={() => setEditing(null)}
                    onOpen={() => enterFolder(row.id)}
                    onDragStart={() => setDragItem({ kind: 'folder', id: row.id })}
                    onDragEnd={() => {
                      setDragItem(null);
                      setDropParentId(null);
                    }}
                    onDragOver={(event) => {
                      if (!dragItem) return;
                      if (!canDrop(dragItem, row.id, folderNodes, viewNames, library.folders, library.snapshots)) return;
                      event.preventDefault();
                      setDropParentId(row.id);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (dragItem) void place(dragItem, row.id);
                      setDragItem(null);
                      setDropParentId(null);
                    }}
                    onContextMenu={(event) => openContextMenu(event, {
                      target: 'folder',
                      item: { kind: 'folder', id: row.id },
                      name: row.name,
                    })}
                    menu={menu}
                    menuRef={menuRef}
                    onToggleMenu={() => {
                      const item = { kind: 'folder' as const, id: row.id };
                      setContextMenu(null);
                      setMenu(menu?.kind === 'folder' && menu.id === row.id ? null : item);
                    }}
                    menuButtons={menuButtons({
                      target: 'folder',
                      item: { kind: 'folder', id: row.id },
                      name: row.name,
                    }, () => setMenu(null))}
                    moving={moving?.kind === 'folder' && moving.id === row.id}
                    sharing={sharing?.kind === 'folder' && sharing.id === row.id}
                    moveSelect={moving?.kind === 'folder' && moving.id === row.id ? (
                      <MoveSelect
                        item={{ kind: 'folder', id: row.id }}
                        folders={library.folders}
                        folderNodes={folderNodes}
                        viewNames={viewNames}
                        snapshots={library.snapshots}
                        onMove={(parentId) => void place({ kind: 'folder', id: row.id }, parentId)}
                      />
                    ) : null}
                    shareField={sharing?.kind === 'folder' && sharing.id === row.id ? (
                      <ShareField
                        name={row.name}
                        value={draftUsername}
                        onChange={setDraftUsername}
                        onCommit={() => void commitShare({ kind: 'folder', id: row.id })}
                        onCancel={() => setSharing(null)}
                      />
                    ) : null}
                  />
                ))}
              </ul>
            </section>
          ) : null}
          <section aria-label="Views">
            <h3>Views</h3>
            {viewCards.length === 0 ? (
              <p className="graph-views-state">
                {isSearching ? 'No views match.' : currentFolderId ? 'This folder is empty.' : 'No saved views yet. Pin a view from Production.'}
              </p>
            ) : (
              <ul className="graph-views-list is-grid">
                {viewCards.map((row) => {
                  const view = library.snapshots.find((entry) => entry.id === row.id);
                  if (!view) return null;
                  return (
                    <ViewCard
                      key={row.id}
                      row={row}
                      showPath={isSearching}
                      view={view}
                      authorName={authorName}
                      isSelected={selectedViewId === row.id}
                      isEditing={editing?.kind === 'view' && editing.id === row.id}
                      draftName={draftName}
                      onDraftName={setDraftName}
                      onCommitRename={() => void commitRename({ kind: 'view', id: row.id }, row.name)}
                      onCancelRename={() => setEditing(null)}
                      onSelect={() => showView(view, true)}
                      onPreview={() => showView(view, false)}
                      onPreviewEnd={() => onShownView(null, false)}
                      onApply={() => applyView(view.id)}
                      onRenameTitle={() => startRename({ kind: 'view', id: row.id }, row.name)}
                      onDragStart={() => setDragItem({ kind: 'view', id: row.id })}
                      onDragEnd={() => {
                        setDragItem(null);
                        setDropParentId(null);
                      }}
                      onContextMenu={(event) => openContextMenu(event, {
                        target: 'view',
                        item: { kind: 'view', id: row.id },
                        name: row.name,
                      })}
                      menuOpen={menu?.kind === 'view' && menu.id === row.id}
                      menuRef={menu?.kind === 'view' && menu.id === row.id ? menuRef : undefined}
                      onToggleMenu={() => {
                        const item = { kind: 'view' as const, id: row.id };
                        setContextMenu(null);
                        setMenu(menu?.kind === 'view' && menu.id === row.id ? null : item);
                      }}
                      menuButtons={menuButtons({
                        target: 'view',
                        item: { kind: 'view', id: row.id },
                        name: row.name,
                      }, () => setMenu(null))}
                      moving={moving?.kind === 'view' && moving.id === row.id ? (
                        <MoveSelect
                          item={{ kind: 'view', id: row.id }}
                          folders={library.folders}
                          folderNodes={folderNodes}
                          viewNames={viewNames}
                          snapshots={library.snapshots}
                          onMove={(parentId) => void place({ kind: 'view', id: row.id }, parentId)}
                        />
                      ) : null}
                      sharing={sharing?.kind === 'view' && sharing.id === row.id ? (
                        <ShareField
                          name={row.name}
                          value={draftUsername}
                          onChange={setDraftUsername}
                          onCommit={() => void commitShare({ kind: 'view', id: row.id })}
                          onCancel={() => setSharing(null)}
                        />
                      ) : null}
                    />
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      ) : (
        <LibraryTable
          rows={listedRows}
          sortKey={sortKey}
          sortDirection={sortDirection}
          expandedIds={expandedIds}
          selectedViewId={selectedViewId}
          isSearching={isSearching}
          emptyLabel={currentFolderId ? 'This folder is empty.' : 'No saved views yet. Pin a view from Production.'}
          onSort={toggleSort}
          onToggle={toggleExpanded}
          onEnter={enterFolder}
          onSelect={(id) => {
            const view = library.snapshots.find((entry) => entry.id === id);
            if (view) showView(view, true);
          }}
          onApply={applyView}
          onPreview={(id) => {
            const view = library.snapshots.find((entry) => entry.id === id);
            if (view) showView(view, false);
          }}
          onPreviewEnd={() => onShownView(null, false)}
          dropParentId={dropParentId}
          canDropOn={(parentId) => Boolean(
            dragItem && canDrop(dragItem, parentId, folderNodes, viewNames, library.folders, library.snapshots),
          )}
          onDragStart={(item) => setDragItem(item)}
          onDragEnd={() => {
            setDragItem(null);
            setDropParentId(null);
          }}
          onDragOverFolder={(folderId) => setDropParentId(folderId)}
          onDropOnFolder={(folderId) => {
            if (dragItem) void place(dragItem, folderId);
            setDragItem(null);
            setDropParentId(null);
          }}
          onContextMenu={(event, row) => openContextMenu(event, {
            target: row.kind,
            item: { kind: row.kind, id: row.id },
            name: row.name,
          })}
        />
      )}
      {contextMenu ? (
        <div
          ref={contextMenuRef}
          className="graph-views-actions-menu graph-views-context-menu"
          role="menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {menuButtons(
            { target: contextMenu.target, item: contextMenu.item, name: contextMenu.name },
            () => setContextMenu(null),
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ViewInspectPanel({
  view,
  onApply,
  onRename,
  onDuplicate,
  onDelete,
}: {
  view: InspectedView | null;
  onApply: (id: string) => void;
  onRename: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (!view) {
    return <p className="graph-views-state">Select a view to see its filters before you apply it.</p>;
  }
  return (
    <div className="graph-view-detail">
      <h3>{view.name}</h3>
      <p>{view.summary}</p>
      <p className="graph-view-detail__when">{view.whenLine}</p>
      {view.hints.length > 0 ? (
        <ul>
          {view.hints.map((hint) => (
            <li key={hint}>{hint}</li>
          ))}
        </ul>
      ) : (
        <p className="graph-view-detail__when">No filters</p>
      )}
      <div className="graph-view-detail__actions">
        <button type="button" onClick={() => onApply(view.id)}>Apply</button>
        <button type="button" onClick={() => onRename(view.id)}>Rename</button>
        <button type="button" onClick={() => onDuplicate(view.id)}>Duplicate</button>
        <button type="button" className="quiet-danger" onClick={() => onDelete(view.id)}>Delete</button>
      </div>
    </div>
  );
}

function FolderCard({
  row,
  showPath,
  isDropTarget,
  isEditing,
  draftName,
  onDraftName,
  onCommitRename,
  onCancelRename,
  onOpen,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onContextMenu,
  menu,
  menuRef,
  onToggleMenu,
  menuButtons,
  moving,
  sharing,
  moveSelect,
  shareField,
}: {
  row: LibraryRow;
  showPath: boolean;
  isDropTarget: boolean;
  isEditing: boolean;
  draftName: string;
  onDraftName: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (event: ReactMouseEvent) => void;
  onDrop: (event: ReactMouseEvent) => void;
  onContextMenu: (event: ReactMouseEvent) => void;
  menu: DragItem | null;
  menuRef: MutableRefObject<HTMLDivElement | null>;
  onToggleMenu: () => void;
  menuButtons: ReactNode;
  moving: boolean;
  sharing: boolean;
  moveSelect: ReactNode;
  shareField: ReactNode;
}) {
  const itemCount = `${row.childCount} ${row.childCount === 1 ? 'item' : 'items'}`;
  return (
    <li
      className={`graph-views-item graph-views-item--folder${isDropTarget ? ' is-drop-target' : ''}`}
      draggable={!isEditing}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onContextMenu={onContextMenu}
    >
      <div
        className="graph-views-item-btn"
        role={isEditing ? undefined : 'button'}
        tabIndex={isEditing ? undefined : 0}
        onClick={() => {
          if (!isEditing && savedViewActivation('folder') === 'enter') onOpen();
        }}
        onDoubleClick={() => {
          if (savedViewActivation('folder', 'double') === 'enter') onOpen();
        }}
        onKeyDown={(event) => {
          if (isEditing || (event.key !== 'Enter' && event.key !== ' ')) return;
          event.preventDefault();
          onOpen();
        }}
      >
        <FolderMark large />
        {isEditing ? (
          <NameField
            label={`Rename ${row.name}`}
            value={draftName}
            onChange={onDraftName}
            onCommit={onCommitRename}
            onCancel={onCancelRename}
          />
        ) : (
          <span className="graph-views-folder-copy">
            <span className="graph-views-item-name">{row.name}</span>
            <span className="graph-views-item-meta">{itemCount}{showPath ? ` · ${row.pathLabel}` : ''}</span>
          </span>
        )}
      </div>
      <ItemMenu
        name={row.name}
        open={menu?.kind === 'folder' && menu.id === row.id}
        menuRef={menu?.kind === 'folder' && menu.id === row.id ? menuRef : undefined}
        onToggle={onToggleMenu}
        buttons={menuButtons}
      />
      {moving ? moveSelect : null}
      {sharing ? shareField : null}
    </li>
  );
}

function ViewCard({
  row,
  showPath,
  view,
  authorName,
  isSelected,
  isEditing,
  draftName,
  onDraftName,
  onCommitRename,
  onCancelRename,
  onSelect,
  onPreview,
  onPreviewEnd,
  onApply,
  onRenameTitle,
  onDragStart,
  onDragEnd,
  onContextMenu,
  menuOpen,
  menuRef,
  onToggleMenu,
  menuButtons,
  moving,
  sharing,
}: {
  row: LibraryRow;
  showPath: boolean;
  view: GraphSnapshotDto;
  authorName: string;
  isSelected: boolean;
  isEditing: boolean;
  draftName: string;
  onDraftName: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onSelect: () => void;
  onPreview: () => void;
  onPreviewEnd: () => void;
  onApply: () => void;
  onRenameTitle: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onContextMenu: (event: ReactMouseEvent) => void;
  menuOpen: boolean;
  menuRef?: MutableRefObject<HTMLDivElement | null>;
  onToggleMenu: () => void;
  menuButtons: ReactNode;
  moving: ReactNode;
  sharing: ReactNode;
}) {
  const hints = filterHintLines(view.filters).join('\n');
  return (
    <li
      className={`graph-views-item graph-views-item--view${isSelected ? ' is-selected' : ''}`}
      draggable={!isEditing}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onContextMenu={onContextMenu}
    >
      <div
        className="graph-views-item-btn"
        role={isEditing ? undefined : 'button'}
        tabIndex={isEditing ? undefined : 0}
        title={hints || view.name}
        onClick={() => {
          if (!isEditing && savedViewActivation('view', 'click') === 'select') onSelect();
        }}
        onDoubleClick={() => {
          if (!isEditing && savedViewActivation('view', 'double') === 'apply') onApply();
        }}
        onKeyDown={(event) => {
          if (isEditing || (event.key !== 'Enter' && event.key !== ' ')) return;
          event.preventDefault();
          onApply();
        }}
        onMouseEnter={onPreview}
        onMouseLeave={onPreviewEnd}
      >
        <span className="graph-views-card-copy">
          {isEditing ? (
            <NameField
              label={`Rename ${row.name}`}
              value={draftName}
              onChange={onDraftName}
              onCommit={onCommitRename}
              onCancel={onCancelRename}
            />
          ) : (
            <span
              className="graph-views-item-name"
              onDoubleClick={(event) => {
                event.stopPropagation();
                event.preventDefault();
                onRenameTitle();
              }}
            >
              {row.name}
            </span>
          )}
          <span className="graph-views-item-summary">{viewSummaryLine(row.filterCount, row.hiddenApps)}</span>
          <span className="graph-views-item-meta">{viewWhenLine(view.updatedAt, authorName, Date.now())}</span>
          {showPath ? <span className="graph-views-item-meta">{row.pathLabel}</span> : null}
        </span>
      </div>
      <ItemMenu name={row.name} open={menuOpen} menuRef={menuRef} onToggle={onToggleMenu} buttons={menuButtons} />
      {moving}
      {sharing}
    </li>
  );
}

function LibraryTable({
  rows,
  sortKey,
  sortDirection,
  expandedIds,
  selectedViewId,
  isSearching,
  emptyLabel,
  onSort,
  onToggle,
  onEnter,
  onSelect,
  onApply,
  onPreview,
  onPreviewEnd,
  dropParentId,
  canDropOn,
  onDragStart,
  onDragEnd,
  onDragOverFolder,
  onDropOnFolder,
  onContextMenu,
}: {
  rows: LibraryRow[];
  sortKey: LibrarySortKey;
  sortDirection: 'asc' | 'desc';
  expandedIds: ReadonlySet<string>;
  selectedViewId: string | null;
  isSearching: boolean;
  emptyLabel: string;
  onSort: (key: LibrarySortKey) => void;
  onToggle: (folderId: string) => void;
  onEnter: (folderId: string) => void;
  onSelect: (viewId: string) => void;
  onApply: (viewId: string) => void;
  onPreview: (viewId: string) => void;
  onPreviewEnd: () => void;
  dropParentId: string | null;
  canDropOn: (folderId: string) => boolean;
  onDragStart: (item: DragItem) => void;
  onDragEnd: () => void;
  onDragOverFolder: (folderId: string) => void;
  onDropOnFolder: (folderId: string) => void;
  onContextMenu: (event: ReactMouseEvent, row: LibraryRow) => void;
}) {
  if (rows.length === 0) {
    return <p className="graph-views-state">{isSearching ? 'No views match.' : emptyLabel}</p>;
  }
  return (
    <table className="graph-views-table">
      <thead>
        <tr>
          {SORT_COLUMNS.map((column) => (
            <th key={column.key} aria-sort={sortKey === column.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
              <button type="button" onClick={() => onSort(column.key)}>
                {column.label}
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={`${row.kind}-${row.id}`}
            className={row.kind === 'view' && selectedViewId === row.id ? 'is-selected' : dropParentId === row.id ? 'is-drop-target' : undefined}
            draggable
            onDragStart={() => onDragStart({ kind: row.kind, id: row.id })}
            onDragEnd={onDragEnd}
            onDragOver={(event) => {
              if (row.kind !== 'folder' || !canDropOn(row.id)) return;
              event.preventDefault();
              onDragOverFolder(row.id);
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (row.kind === 'folder') onDropOnFolder(row.id);
            }}
            onContextMenu={(event) => onContextMenu(event, row)}
            onMouseEnter={() => {
              if (row.kind === 'view') onPreview(row.id);
            }}
            onMouseLeave={onPreviewEnd}
            onClick={() => {
              if (row.kind === 'folder') onEnter(row.id);
              else if (savedViewActivation('view', 'click') === 'select') onSelect(row.id);
            }}
            onDoubleClick={() => {
              if (row.kind === 'view' && savedViewActivation('view', 'double') === 'apply') onApply(row.id);
              if (row.kind === 'folder') onEnter(row.id);
            }}
          >
            <td style={{ paddingLeft: `${0.7 + row.depth * 1.1}rem` }}>
              {row.kind === 'folder' && !isSearching ? (
                <button
                  type="button"
                  className="graph-views-disclose"
                  aria-expanded={expandedIds.has(row.id)}
                  aria-label={expandedIds.has(row.id) ? `Collapse ${row.name}` : `Expand ${row.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggle(row.id);
                  }}
                >
                  {expandedIds.has(row.id) ? '▾' : '▸'}
                </button>
              ) : null}
              <span>{row.name}</span>
              {isSearching ? <span className="graph-views-item-meta"> {row.pathLabel}</span> : null}
            </td>
            <td>{row.kind === 'view' ? viewSummaryLine(row.filterCount, row.hiddenApps) : `${row.childCount} ${row.childCount === 1 ? 'item' : 'items'}`}</td>
            <td>{relativeDay(row.updatedAt)}</td>
            <td>{row.author}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function relativeDay(updatedAt: string): string {
  return viewWhenLine(updatedAt, '', Date.now()).replace(' · by ', '');
}

function ItemMenu({
  name,
  open,
  menuRef,
  onToggle,
  buttons,
}: {
  name: string;
  open: boolean;
  menuRef?: MutableRefObject<HTMLDivElement | null>;
  onToggle: () => void;
  buttons: ReactNode;
}) {
  return (
    <div className="graph-views-actions" ref={menuRef}>
      <button
        type="button"
        className="graph-views-actions-btn"
        aria-label={`Actions for ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
      >
        <KebabIcon />
      </button>
      {open ? <div className="graph-views-actions-menu" role="menu">{buttons}</div> : null}
    </div>
  );
}

function NameField({
  label,
  value,
  onChange,
  onCommit,
  onCancel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  return (
    <input
      className="graph-views-item-name-input"
      aria-label={label}
      value={value}
      autoFocus
      onChange={(event) => onChange(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') {
          event.preventDefault();
          onCommit();
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
        }
      }}
      onBlur={onCommit}
    />
  );
}

function ShareField({
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
      className="graph-views-item-name-input"
      aria-label={`Username to receive ${name}`}
      placeholder="Username"
      value={value}
      autoFocus
      onChange={(event) => onChange(event.target.value)}
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

function inspectedFrom(view: GraphSnapshotDto, authorName: string): InspectedView {
  return {
    id: view.id,
    name: view.name,
    summary: viewSummaryLine(activeFilterCount(view.filters), view.filters.hiddenApplicationIds?.length ?? 0),
    whenLine: viewWhenLine(view.updatedAt, authorName, Date.now()),
    hints: filterHintLines(view.filters),
  };
}

function viewSummaryCount(view: GraphSnapshotDto): number {
  return activeFilterCount(view.filters);
}

function folderCardRow(
  folder: GraphViewFolderDto,
  folders: LibraryFolder[],
  views: LibraryView[],
  author: string,
): LibraryRow {
  return {
    kind: 'folder',
    id: folder.id,
    name: folder.name,
    depth: 0,
    pathLabel: folderBreadcrumb(folders, folder.parentId).map((crumb) => crumb.label).join(' / '),
    filterCount: 0,
    hiddenApps: 0,
    updatedAt: folder.updatedAt,
    author,
    childCount: folderItemCount(folders, views, folder.id),
  };
}

function viewCardRow(view: GraphSnapshotDto, folders: LibraryFolder[], author: string): LibraryRow {
  return {
    kind: 'view',
    id: view.id,
    name: view.name,
    depth: 0,
    pathLabel: folderBreadcrumb(folders, view.folderId ?? null).map((crumb) => crumb.label).join(' / '),
    filterCount: viewSummaryCount(view),
    hiddenApps: view.filters.hiddenApplicationIds?.length ?? 0,
    updatedAt: view.updatedAt,
    author,
    childCount: 0,
  };
}

function readStoredViewLayout(): ViewLayout {
  try {
    return storedViewLayout(localStorage.getItem(VIEW_LAYOUT_STORAGE_KEY));
  } catch {
    return 'list';
  }
}

function FolderMark({ large = false }: { large?: boolean }) {
  const size = large ? 28 : 16;
  return (
    <svg className="graph-views-item-mark" viewBox="0 0 20 20" width={size} height={size} aria-hidden="true" focusable="false">
      <path
        d="M3 6.5 A1.5 1.5 0 0 1 4.5 5 H8 L9.5 6.8 H15.5 A1.5 1.5 0 0 1 17 8.3 V14.5 A1.5 1.5 0 0 1 15.5 16 H4.5 A1.5 1.5 0 0 1 3 14.5 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function KebabIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
      <circle cx="10" cy="4.5" r="1.3" fill="currentColor" />
      <circle cx="10" cy="10" r="1.3" fill="currentColor" />
      <circle cx="10" cy="15.5" r="1.3" fill="currentColor" />
    </svg>
  );
}

function GridGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="9" y="2" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="2" y="9" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="9" y="9" width="5" height="5" rx="1" fill="currentColor" />
    </svg>
  );
}

function ListGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <circle cx="2.6" cy="4" r="1" fill="currentColor" />
      <circle cx="2.6" cy="8" r="1" fill="currentColor" />
      <circle cx="2.6" cy="12" r="1" fill="currentColor" />
      <path d="M5.6 4H14M5.6 8H14M5.6 12H14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type MutableRefObject, type ReactNode } from 'react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useGraphSnapshotsList } from '../hooks/useGraphSnapshotsList';
import type { GraphSnapshotDto, GraphSnapshotFilters, GraphViewFolderDto } from '@/types/api';
import {
  folderParentForNewFolder,
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
  descendantFolderIds,
  nextFolderName,
  type FolderNode,
  type ViewName,
} from '../utils/viewFolderRules';
import { VIEW_LAYOUT_STORAGE_KEY, type ViewLayout } from '../utils/viewLayout';
import {
  flattenLibrary,
  folderBreadcrumb,
  searchLibrary,
  type LibraryFolder,
  type LibrarySortKey,
  type LibraryView,
} from '../utils/viewLibrary';
import {
  canDrop,
  FolderCard,
  FolderCrumbs,
  folderCardRow,
  GridGlyph,
  inspectedFrom,
  LibraryTable,
  ListGlyph,
  MoveSelect,
  readStoredViewLayout,
  ShareField,
  ViewCard,
  viewCardRow,
  ViewsEmptyState,
  type DragItem,
  type InspectedView,
} from './graphViewsChrome';

/** The list shows one folder at a time: folders open by entering them, never inline. */
const NO_EXPANDED_FOLDERS: ReadonlySet<string> = new Set();

export { FolderCrumbs, ViewInspectPanel, ViewsEmptyState } from './graphViewsChrome';
export type { InspectedView };

type GraphViewsPanelProps = {
  onApply: (filters: GraphSnapshotFilters, viewName: string) => void;
  onShownView: (view: InspectedView | null, pin: boolean) => void;
  onCreateView: () => void;
  panelToggle: ReactNode;
  actionsRef: MutableRefObject<ViewLibraryActions | null>;
};

function renderLibraryStatus(panelToggle: ReactNode, message: string, isError: boolean) {
  return (
    <div id="graph-views-pane" className="graph-views-pane" role="tabpanel" aria-labelledby="graph-mode-tab-views">
      <div className="graph-views-toolbar">
        <div className="graph-views-toolbar-end">{panelToggle}</div>
      </div>
      <p className={isError ? 'graph-views-state graph-views-state-error' : 'graph-views-state'} role={isError ? 'alert' : 'status'}>
        {message}
      </p>
    </div>
  );
}

export type ViewLibraryActions = {
  apply: (id: string) => void;
  rename: (id: string) => void;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
};

type ViewContextMenu = {
  x: number;
  y: number;
  target: ViewMenuTarget;
  item: DragItem | null;
  name: string;
};

export function GraphViewsPanel({ onApply, onShownView, onCreateView, panelToggle, actionsRef }: GraphViewsPanelProps) {
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
    : flattenLibrary(libraryFolders, libraryViews, currentFolderId, NO_EXPANDED_FOLDERS, sortKey, sortDirection, authorName);

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

  if (library.status === 'loading') {
    return renderLibraryStatus(panelToggle, 'Loading…', false);
  }
  if (library.status === 'error') {
    return renderLibraryStatus(panelToggle, library.errorMessage ?? 'Unable to load views.', true);
  }

  const isSearching = query.trim().length > 0;
  const emptyTitle = currentFolderId ? 'This folder is empty.' : 'No saved views yet.';
  const folderCards = isSearching
    ? listedRows.filter((row) => row.kind === 'folder')
    : childFolders.map((folder) => folderCardRow(folder, libraryFolders, libraryViews, authorName));
  const viewCards = isSearching
    ? listedRows.filter((row) => row.kind === 'view')
    : childViews.map((view) => viewCardRow(view, libraryFolders, authorName));
  const isListingEmpty = folderCards.length === 0 && viewCards.length === 0;

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
        <div className="graph-views-layout-switch" role="group" aria-label="Layout">
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
        <button
          type="button"
          className="graph-views-new"
          disabled={!canCreateIn(folderNodes, currentFolderId)}
          onClick={() => createFolderIn(currentFolderId)}
        >
          <span aria-hidden="true">+</span>
          New folder
        </button>
        {panelToggle}
      </div>
      <FolderCrumbs
        crumbs={crumbs}
        currentFolderId={currentFolderId}
        onOpen={(folderId) => {
          setCurrentFolderId(folderId);
          setQuery('');
        }}
      />
      {library.errorMessage ? (
        <p className="graph-views-state graph-views-state-error" role="alert">{library.errorMessage}</p>
      ) : notice ? (
        <p className="graph-views-state" role="status">{notice}</p>
      ) : null}
      {isListingEmpty ? (
        isSearching ? (
          <p className="graph-views-state">No views match.</p>
        ) : (
          <ViewsEmptyState title={emptyTitle} onCreate={onCreateView} />
        )
      ) : layout === 'grid' ? (
        <div className="graph-views-sections">
          {folderCards.length > 0 ? (
            <section aria-label="Folders">
              <h3>Folders</h3>
              <ul className="graph-views-cards">
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
          {viewCards.length > 0 ? (
          <section aria-label="Views">
            <h3>Views</h3>
              <ul className="graph-views-cards">
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
          </section>
          ) : null}
        </div>
      ) : (
        <LibraryTable
          rows={listedRows}
          sortKey={sortKey}
          sortDirection={sortDirection}
          selectedViewId={selectedViewId}
          isSearching={isSearching}
          emptyLabel={emptyTitle}
          onSort={toggleSort}
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


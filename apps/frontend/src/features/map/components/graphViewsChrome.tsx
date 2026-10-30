import { useState, type MouseEvent as ReactMouseEvent, type MutableRefObject, type ReactNode } from 'react';
import type { GraphSnapshotDto, GraphViewFolderDto } from '@/types/api';
import { savedViewActivation } from '../utils/viewContextMenu';
import {
  canMoveFolder,
  nameTaken,
  type FolderNode,
  type ViewName,
} from '../utils/viewFolderRules';
import { storedViewLayout, VIEW_LAYOUT_STORAGE_KEY, type ViewLayout } from '../utils/viewLayout';
import {
  activeFilterCount,
  filterHintLines,
  folderBreadcrumb,
  folderItemCount,
  viewSummaryLine,
  viewWhenLine,
  type LibraryFolder,
  type LibraryRow,
  type LibrarySortKey,
  type LibraryView,
} from '../utils/viewLibrary';

export type InspectedView = {
  id: string;
  name: string;
  summary: string;
  whenLine: string;
  hints: string[];
  hiddenApplicationIds: string[];
};

export type DragItem = { kind: 'view' | 'folder'; id: string };

const CARD_MARK_SIZE = 18;
const ROW_MARK_SIZE = 16;
const EMPTY_MARK_SIZE = 32;
const QUIET_MARK_SIZE = 22;

const SORT_COLUMNS: { key: LibrarySortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'filters', label: 'Filters' },
  { key: 'modified', label: 'Modified' },
  { key: 'author', label: 'Author' },
];

export function ViewInspectPanel({
  view,
  applicationNames,
  onApply,
  onRename,
  onDuplicate,
  onDelete,
}: {
  view: InspectedView | null;
  applicationNames: Record<string, string>;
  onApply: (id: string) => void;
  onRename: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (!view) {
    return (
      <div className="graph-views-empty graph-views-empty--quiet">
        <InspectMark />
        <p>Select a view to see its filters before you apply it.</p>
      </div>
    );
  }
  return (
    <div className="graph-view-detail">
      <h3>{view.name}</h3>
      <p>{view.summary}</p>
      <p className="graph-view-detail__when">{view.whenLine}</p>
      <ViewFilterTags hints={view.hints} />
      <HiddenApplications key={view.id} applicationIds={view.hiddenApplicationIds} names={applicationNames} />
      <DetailActions
        onApply={() => onApply(view.id)}
        onRename={() => onRename(view.id)}
        onDuplicate={() => onDuplicate(view.id)}
        onDelete={() => onDelete(view.id)}
      />
    </div>
  );
}

export function FolderCrumbs({
  crumbs,
  currentFolderId,
  onOpen,
}: {
  crumbs: { id: string | null; label: string }[];
  currentFolderId: string | null;
  onOpen: (folderId: string | null) => void;
}) {
  if (currentFolderId == null) return null;
  return (
    <nav className="graph-views-crumbs" aria-label="View folders">
      {crumbs.map((crumb, index) => (
        <span key={crumb.id ?? 'root'} className="graph-views-crumb">
          {index > 0 ? <span aria-hidden="true">›</span> : null}
          <button
            type="button"
            aria-current={crumb.id === currentFolderId ? 'page' : undefined}
            onClick={() => onOpen(crumb.id)}
          >
            {crumb.label}
          </button>
        </span>
      ))}
    </nav>
  );
}

export function ViewsEmptyState({ title, onCreate }: { title: string; onCreate: () => void }) {
  return (
    <div className="graph-views-empty">
      <FolderMark size={EMPTY_MARK_SIZE} />
      <p className="graph-views-empty__title">{title}</p>
      <p className="graph-views-empty__help">Drop a view here, or create one from the graph.</p>
      <button type="button" className="graph-views-create" onClick={onCreate}>
        Create a view
      </button>
    </div>
  );
}

export function FolderCard({
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
        <FolderMark size={CARD_MARK_SIZE} />
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
            <span className="graph-views-item-summary">{itemCount}{showPath ? ` · ${row.pathLabel}` : ''}</span>
            <span className="graph-views-item-meta">{viewWhenLine(row.updatedAt, row.author, Date.now())}</span>
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

export function ViewCard({
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
        <ViewMark />
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

export function LibraryTable({
  rows,
  sortKey,
  sortDirection,
  selectedViewId,
  isSearching,
  emptyLabel,
  onSort,
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
  selectedViewId: string | null;
  isSearching: boolean;
  emptyLabel: string;
  onSort: (key: LibrarySortKey) => void;
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
            <td>
              {row.kind === 'folder' ? <FolderMark size={ROW_MARK_SIZE} className="graph-views-row-icon" /> : <ViewMark size={ROW_MARK_SIZE} className="graph-views-row-icon" />}
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

export function ShareField({
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

export function MoveSelect({
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

export function canDrop(
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

export function inspectedFrom(view: GraphSnapshotDto, authorName: string): InspectedView {
  return {
    id: view.id,
    name: view.name,
    summary: viewSummaryLine(activeFilterCount(view.filters), view.filters.hiddenApplicationIds?.length ?? 0),
    whenLine: viewWhenLine(view.updatedAt, authorName, Date.now()),
    hints: filterHintLines(view.filters),
    hiddenApplicationIds: view.filters.hiddenApplicationIds ?? [],
  };
}

function viewSummaryCount(view: GraphSnapshotDto): number {
  return activeFilterCount(view.filters);
}

export function folderCardRow(
  folder: GraphViewFolderDto,
  folders: LibraryFolder[],
  views: LibraryView[],
  author: string,
): LibraryRow {
  return {
    kind: 'folder',
    id: folder.id,
    name: folder.name,
    pathLabel: folderBreadcrumb(folders, folder.parentId).map((crumb) => crumb.label).join(' / '),
    filterCount: 0,
    hiddenApps: 0,
    updatedAt: folder.updatedAt,
    author,
    childCount: folderItemCount(folders, views, folder.id),
  };
}

export function viewCardRow(view: GraphSnapshotDto, folders: LibraryFolder[], author: string): LibraryRow {
  return {
    kind: 'view',
    id: view.id,
    name: view.name,
    pathLabel: folderBreadcrumb(folders, view.folderId ?? null).map((crumb) => crumb.label).join(' / '),
    filterCount: viewSummaryCount(view),
    hiddenApps: view.filters.hiddenApplicationIds?.length ?? 0,
    updatedAt: view.updatedAt,
    author,
    childCount: 0,
  };
}

export function readStoredViewLayout(): ViewLayout {
  try {
    return storedViewLayout(localStorage.getItem(VIEW_LAYOUT_STORAGE_KEY));
  } catch {
    return 'list';
  }
}

function FolderMark({ size, className = '' }: { size: number; className?: string }) {
  return (
    <svg className={`graph-views-item-mark ${className}`.trim()} viewBox="0 0 20 20" width={size} height={size} aria-hidden="true" focusable="false">
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
      <circle cx="4.5" cy="10" r="1.3" fill="currentColor" />
      <circle cx="10" cy="10" r="1.3" fill="currentColor" />
      <circle cx="15.5" cy="10" r="1.3" fill="currentColor" />
    </svg>
  );
}

function ViewMark({ size = CARD_MARK_SIZE, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={`graph-views-item-mark ${className}`.trim()} viewBox="0 0 20 20" width={size} height={size} aria-hidden="true" focusable="false">
      <rect x="3.5" y="3" width="13" height="14" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 7.5h7M6.5 10.5h7M6.5 13.5h4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function InspectMark() {
  return (
    <svg className="graph-views-item-mark" viewBox="0 0 20 20" width={QUIET_MARK_SIZE} height={QUIET_MARK_SIZE} aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="14" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 8h8M6 12h5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ViewFilterTags({ hints }: { hints: string[] }) {
  if (hints.length === 0) return <p className="graph-view-detail__when">No filters</p>;
  return (
    <div className="graph-view-detail__tags">
      {hints.map((hint) => (
        <span key={hint} className="graph-view-detail__tag">{hint}</span>
      ))}
    </div>
  );
}

function HiddenApplications({
  applicationIds,
  names,
}: {
  applicationIds: string[];
  names: Record<string, string>;
}) {
  const [isListOpen, setListOpen] = useState(false);
  if (applicationIds.length === 0) return null;
  const label = `${applicationIds.length} ${applicationIds.length === 1 ? 'hidden app' : 'hidden apps'}`;
  return (
    <div className="graph-view-detail__hidden">
      <p>
        {label}{' '}
        <button type="button" className="graph-view-detail__see" onClick={() => setListOpen((current) => !current)}>
          {isListOpen ? 'Hide' : 'See'}
        </button>
      </p>
      {isListOpen ? (
        <ul className="graph-view-detail__hidden-list">
          {applicationIds.map((applicationId) => (
            <li key={applicationId}>{names[applicationId] ?? applicationId}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DetailActions({
  onApply,
  onRename,
  onDuplicate,
  onDelete,
}: {
  onApply: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="graph-view-detail__actions">
      <div className="graph-view-detail__actions-row">
        <button type="button" className="graph-view-detail__apply" onClick={onApply}>Apply</button>
        <button type="button" onClick={onRename}>Rename</button>
        <button type="button" onClick={onDuplicate}>Duplicate</button>
      </div>
      <button type="button" className="is-danger-ghost" onClick={onDelete}>Delete</button>
    </div>
  );
}

export function GridGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="9" y="2" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="2" y="9" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="9" y="9" width="5" height="5" rx="1" fill="currentColor" />
    </svg>
  );
}

export function ListGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <circle cx="2.6" cy="4" r="1" fill="currentColor" />
      <circle cx="2.6" cy="8" r="1" fill="currentColor" />
      <circle cx="2.6" cy="12" r="1" fill="currentColor" />
      <path d="M5.6 4H14M5.6 8H14M5.6 12H14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

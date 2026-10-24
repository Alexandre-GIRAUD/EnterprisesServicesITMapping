export type LibraryFolder = {
  id: string;
  parentId: string | null;
  name: string;
  updatedAt: string;
};

export type LibraryView = {
  id: string;
  folderId: string | null;
  name: string;
  updatedAt: string;
  filters: ViewFilterSource;
};

export type ViewFilterSource = {
  applicationIds?: string[];
  nodeAttributes?: Record<string, string[]>;
  nodeRefs?: Record<string, string[]>;
  edgeAttributes?: Record<string, string[]>;
  edgeIds?: string[];
  hiddenApplicationIds?: string[];
};

export type LibrarySortKey = 'name' | 'filters' | 'modified' | 'author';
export type LibrarySortDirection = 'asc' | 'desc';

export type LibraryCrumb = { id: string | null; label: string };

export type LibraryRow = {
  kind: 'folder' | 'view';
  id: string;
  name: string;
  depth: number;
  pathLabel: string;
  filterCount: number;
  hiddenApps: number;
  updatedAt: string;
  author: string;
  childCount: number;
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function folderBreadcrumb(folders: LibraryFolder[], folderId: string | null): LibraryCrumb[] {
  const trail: LibraryCrumb[] = [];
  const seen = new Set<string>();
  let current = folderId ? folders.find((folder) => folder.id === folderId) : undefined;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    trail.push({ id: current.id, label: current.name });
    current = current.parentId
      ? folders.find((folder) => folder.id === current?.parentId)
      : undefined;
  }
  return [{ id: null, label: 'My views' }, ...trail.reverse()];
}

export function folderItemCount(
  folders: LibraryFolder[],
  views: LibraryView[],
  folderId: string,
): number {
  const nestedFolders = folders.filter((folder) => folder.parentId === folderId).length;
  const nestedViews = views.filter((view) => view.folderId === folderId).length;
  return nestedFolders + nestedViews;
}

export function activeFilterCount(filters: ViewFilterSource): number {
  let count = filters.applicationIds?.length ? 1 : 0;
  count += filledGroups(filters.nodeAttributes);
  count += filledGroups(filters.nodeRefs);
  count += filledGroups(filters.edgeAttributes);
  if (filters.edgeIds?.length) count += 1;
  return count;
}

export function hiddenAppCount(filters: ViewFilterSource): number {
  return filters.hiddenApplicationIds?.length ?? 0;
}

export const AUTHOR_NAME_MAX_LENGTH = 22;

export function truncateAuthorName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= AUTHOR_NAME_MAX_LENGTH) return trimmed;
  return `${trimmed.slice(0, AUTHOR_NAME_MAX_LENGTH - 1)}…`;
}

export function viewInfoLines(
  filterCount: number,
  hiddenApps: number,
  updatedAt: string,
  author: string,
  nowMs: number,
): readonly [string, string, string, string] {
  return [
    countPhrase(filterCount, 'filter', 'filters'),
    countPhrase(hiddenApps, 'hidden app', 'hidden apps'),
    relativeModifiedLabel(updatedAt, nowMs),
    `by ${truncateAuthorName(author)}`,
  ];
}

export function viewSummaryLine(filterCount: number, hiddenApps: number): string {
  return `${countPhrase(filterCount, 'filter', 'filters')} · ${countPhrase(hiddenApps, 'hidden app', 'hidden apps')}`;
}

export function viewWhenLine(updatedAt: string, author: string, nowMs: number): string {
  return `${relativeModifiedLabel(updatedAt, nowMs)} · by ${author}`;
}

export function filterHintLines(filters: ViewFilterSource): string[] {
  const lines: string[] = [];
  if (filters.applicationIds?.length) {
    lines.push(`Applications = ${filters.applicationIds.length}`);
  }
  pushGroups(lines, filters.nodeAttributes);
  pushGroups(lines, filters.nodeRefs);
  pushGroups(lines, filters.edgeAttributes);
  if (filters.edgeIds?.length) lines.push(`Flows = ${filters.edgeIds.length}`);
  return lines;
}

export function relativeModifiedLabel(updatedAt: string, nowMs: number): string {
  const updatedMs = Date.parse(updatedAt);
  if (!Number.isFinite(updatedMs)) return 'Modified';
  const elapsed = Math.max(0, nowMs - updatedMs);
  if (elapsed < MINUTE_MS) return 'Modified just now';
  if (elapsed < HOUR_MS) return `Modified ${Math.floor(elapsed / MINUTE_MS)}m ago`;
  if (elapsed < DAY_MS) return `Modified ${Math.floor(elapsed / HOUR_MS)}h ago`;
  return `Modified ${Math.floor(elapsed / DAY_MS)}d ago`;
}

export function compareLibraryEntries(
  left: Pick<LibraryRow, 'name' | 'filterCount' | 'updatedAt' | 'author'>,
  right: Pick<LibraryRow, 'name' | 'filterCount' | 'updatedAt' | 'author'>,
  key: LibrarySortKey,
  direction: LibrarySortDirection,
): number {
  const nameOrder = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
  let order = nameOrder;
  if (key === 'filters') order = left.filterCount - right.filterCount || nameOrder;
  if (key === 'modified') order = Date.parse(left.updatedAt) - Date.parse(right.updatedAt) || nameOrder;
  if (key === 'author') {
    order = left.author.localeCompare(right.author, undefined, { sensitivity: 'base' }) || nameOrder;
  }
  return direction === 'asc' ? order : -order;
}

export function flattenLibrary(
  folders: LibraryFolder[],
  views: LibraryView[],
  rootId: string | null,
  expandedIds: ReadonlySet<string>,
  sortKey: LibrarySortKey,
  direction: LibrarySortDirection,
  author: string,
): LibraryRow[] {
  const rows: LibraryRow[] = [];
  function walk(parentId: string | null, depth: number) {
    const childFolders = folders.filter((folder) => folder.parentId === parentId);
    const childViews = views.filter((view) => view.folderId === parentId);
    const folderRows = childFolders.map((folder) =>
      toFolderRow(folder, folders, views, depth, author),
    );
    const viewRows = childViews.map((view) => toViewRow(view, folders, depth, author));
    folderRows.sort((left, right) => compareLibraryEntries(left, right, sortKey, direction));
    viewRows.sort((left, right) => compareLibraryEntries(left, right, sortKey, direction));
    for (const folder of folderRows) {
      rows.push(folder);
      if (expandedIds.has(folder.id)) walk(folder.id, depth + 1);
    }
    rows.push(...viewRows);
  }
  walk(rootId, 0);
  return rows;
}

export function searchLibrary(
  query: string,
  folders: LibraryFolder[],
  views: LibraryView[],
  sortKey: LibrarySortKey,
  direction: LibrarySortDirection,
  author: string,
): LibraryRow[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const folderHits = folders
    .filter((folder) => folder.name.toLowerCase().includes(needle))
    .map((folder) => toFolderRow(folder, folders, views, 0, author));
  const viewHits = views
    .filter((view) => view.name.toLowerCase().includes(needle))
    .map((view) => toViewRow(view, folders, 0, author));
  folderHits.sort((left, right) => compareLibraryEntries(left, right, sortKey, direction));
  viewHits.sort((left, right) => compareLibraryEntries(left, right, sortKey, direction));
  return [...folderHits, ...viewHits];
}

function toFolderRow(
  folder: LibraryFolder,
  folders: LibraryFolder[],
  views: LibraryView[],
  depth: number,
  author: string,
): LibraryRow {
  return {
    kind: 'folder',
    id: folder.id,
    name: folder.name,
    depth,
    pathLabel: ancestorPath(folders, folder.parentId),
    filterCount: 0,
    hiddenApps: 0,
    updatedAt: folder.updatedAt,
    author,
    childCount: folderItemCount(folders, views, folder.id),
  };
}

function toViewRow(view: LibraryView, folders: LibraryFolder[], depth: number, author: string): LibraryRow {
  return {
    kind: 'view',
    id: view.id,
    name: view.name,
    depth,
    pathLabel: ancestorPath(folders, view.folderId),
    filterCount: activeFilterCount(view.filters),
    hiddenApps: hiddenAppCount(view.filters),
    updatedAt: view.updatedAt,
    author,
    childCount: 0,
  };
}

function ancestorPath(folders: LibraryFolder[], folderId: string | null): string {
  return folderBreadcrumb(folders, folderId)
    .map((crumb) => crumb.label)
    .join(' / ');
}

function filledGroups(groups: Record<string, string[]> | undefined): number {
  if (!groups) return 0;
  return Object.values(groups).filter((values) => values.length > 0).length;
}

function pushGroups(lines: string[], groups: Record<string, string[]> | undefined) {
  if (!groups) return;
  for (const [key, values] of Object.entries(groups)) {
    if (values.length > 0) lines.push(`${key} = ${values.join(', ')}`);
  }
}

function countPhrase(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

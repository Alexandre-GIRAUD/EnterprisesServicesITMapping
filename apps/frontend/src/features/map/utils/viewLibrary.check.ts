/**
 * Runnable self-check for the saved-view library.
 * Run: npx --yes tsx src/features/map/utils/viewLibrary.check.ts
 */
import assert from 'node:assert/strict';
import {
  activeFilterCount,
  compareLibraryEntries,
  filterHintLines,
  flattenLibrary,
  folderBreadcrumb,
  folderItemCount,
  relativeModifiedLabel,
  searchLibrary,
  viewSummaryLine,
  viewWhenLine,
  type LibraryFolder,
  type LibraryView,
} from './viewLibrary.ts';

const now = Date.parse('2026-10-20T12:00:00.000Z');
const folders: LibraryFolder[] = [
  { id: 'clients', parentId: null, name: 'Clients', updatedAt: '2026-10-01T00:00:00.000Z' },
  { id: 'year', parentId: 'clients', name: '2025', updatedAt: '2026-10-02T00:00:00.000Z' },
];
const views: LibraryView[] = [
  {
    id: 'prod',
    folderId: 'year',
    name: 'Production Java',
    updatedAt: '2026-10-18T12:00:00.000Z',
    filters: {
      nodeAttributes: { Techno: ['Java'], Env: ['prod'] },
      edgeAttributes: { Protocol: ['https'] },
      hiddenApplicationIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'],
    },
  },
  {
    id: 'root-view',
    folderId: null,
    name: 'Overview',
    updatedAt: '2026-10-19T12:00:00.000Z',
    filters: { applicationIds: ['app-1'] },
  },
];

assert.deepEqual(folderBreadcrumb(folders, 'year'), [
  { id: null, label: 'My views' },
  { id: 'clients', label: 'Clients' },
  { id: 'year', label: '2025' },
]);
assert.equal(folderItemCount(folders, views, 'clients'), 1);
assert.equal(folderItemCount(folders, views, 'year'), 1);
assert.equal(activeFilterCount(views[0].filters), 3);
assert.equal(viewSummaryLine(3, 12), '3 filters · 12 hidden apps');
assert.equal(viewWhenLine(views[0].updatedAt, 'Alex', now), 'Modified 2d ago · by Alex');
assert.deepEqual(filterHintLines(views[0].filters), [
  'Techno = Java',
  'Env = prod',
  'Protocol = https',
]);
assert.equal(relativeModifiedLabel('2026-10-20T11:59:30.000Z', now), 'Modified just now');

const tree = flattenLibrary(folders, views, null, new Set(['clients']), 'name', 'asc', 'Alex');
assert.deepEqual(
  tree.map((row) => `${row.kind}:${row.name}:${row.depth}`),
  ['folder:Clients:0', 'folder:2025:1', 'view:Overview:0'],
);

const found = searchLibrary('java', folders, views, 'name', 'asc', 'Alex');
assert.equal(found.length, 1);
assert.equal(found[0].pathLabel, 'My views / Clients / 2025');

assert.ok(
  compareLibraryEntries(
    { name: 'B', filterCount: 1, updatedAt: '2026-10-01T00:00:00.000Z', author: 'Alex' },
    { name: 'A', filterCount: 4, updatedAt: '2026-10-02T00:00:00.000Z', author: 'Alex' },
    'filters',
    'desc',
  ) > 0,
);

console.log('viewLibrary.check: ok');

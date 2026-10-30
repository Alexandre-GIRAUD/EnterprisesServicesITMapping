/**
 * Runnable self-check for the My views library chrome.
 * Run: npx --yes tsx src/features/map/components/viewsLibraryChrome.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FolderCrumbs, ViewInspectPanel, ViewsEmptyState } from './GraphViewsPanel.tsx';
import { LibraryTable } from './graphViewsChrome.tsx';

const css = readFileSync(new URL('../../../index.css', import.meta.url), 'utf8');
const panel = readFileSync(new URL('./GraphViewsPanel.tsx', import.meta.url), 'utf8');
const chrome = readFileSync(new URL('./graphViewsChrome.tsx', import.meta.url), 'utf8');
const librarySource = `${panel}\n${chrome}`;

assert.match(css, /\.graph-views-cards \{[^}]*minmax\(min\(100%, 16\.5rem\), 17\.5rem\)/);
assert.match(css, /\.graph-views-item-name \{[^}]*font-size: 15px/);
assert.match(css, /\.graph-views-item-summary \{[^}]*color: #64748b/);
assert.match(css, /\.graph-views-item-meta \{[^}]*font-size: 12px/);
assert.match(css, /\.graph-views-crumb button:not\(\[aria-current='page'\]\):hover \{[^}]*text-decoration: underline/);
assert.match(css, /\.graph-views-crumb button \{[^}]*color: #64748b/);
assert.match(css, /\.graph-views-layout-switch \{/);
assert.match(css, /\.graph-view-detail__apply \{[^}]*var\(--ss-views-accent/);
assert.match(css, /\.is-danger-ghost \{[^}]*background: transparent/);
assert.doesNotMatch(css, /\.graph-views-actions-btn svg \{[^}]*rotate\(90deg\)/);
assert.doesNotMatch(css, /\.graph-views-item--folder \.graph-views-item-mark \{[^}]*#2563eb/);
assert.doesNotMatch(css, /\.graph-views-item-btn:hover \{[^}]*#93c5fd/);
assert.match(librarySource, /cx="4.5" cy="10"/);
assert.match(librarySource, /title="Grid"/);
assert.match(librarySource, /title="List"/);

const row = (kind: 'folder' | 'view', id: string) => ({
  kind, id, name: id, pathLabel: '', filterCount: 0, hiddenApps: 0, updatedAt: '2026-01-01T00:00:00.000Z', author: 'admin', childCount: 1,
});
const noop = () => undefined;
const table = renderToStaticMarkup(
  createElement(LibraryTable, {
    rows: [row('folder', 'finance'), row('view', 'payments')],
    sortKey: 'name', sortDirection: 'asc', selectedViewId: null,
    isSearching: false, emptyLabel: '', onSort: noop, onEnter: noop, onSelect: noop,
    onApply: noop, onPreview: noop, onPreviewEnd: noop, dropParentId: null, canDropOn: () => false,
    onDragStart: noop, onDragEnd: noop, onDragOverFolder: noop, onDropOnFolder: noop, onContextMenu: noop,
  }),
);
assert.doesNotMatch(table, /padding-left/);
assert.doesNotMatch(table, /graph-views-disclose|aria-expanded|▸|▾/);
assert.match(table, /<td[^>]*><svg class="graph-views-item-mark graph-views-row-icon"/);
assert.equal(table.match(/graph-views-row-icon/g)?.length, 2);
assert.notEqual(
  table.match(/graph-views-row-icon[^]*?<\/svg>/g)?.[0],
  table.match(/graph-views-row-icon[^]*?<\/svg>/g)?.[1],
  'folders and views get different icons',
);

const rootCrumbs = renderToStaticMarkup(
  createElement(FolderCrumbs, {
    crumbs: [{ id: null, label: 'My views' }],
    currentFolderId: null,
    onOpen: () => undefined,
  }),
);
assert.equal(rootCrumbs, '');

const nestedCrumbs = renderToStaticMarkup(
  createElement(FolderCrumbs, {
    crumbs: [
      { id: null, label: 'My views' },
      { id: 'folder-2', label: 'New folder 2' },
    ],
    currentFolderId: 'folder-2',
    onOpen: () => undefined,
  }),
);
assert.match(nestedCrumbs, /aria-label="View folders"/);
assert.match(nestedCrumbs, />My views</);
assert.match(nestedCrumbs, /aria-current="page"/);
assert.match(nestedCrumbs, />New folder 2</);

const emptyLibrary = renderToStaticMarkup(
  createElement(ViewsEmptyState, {
    title: 'This folder is empty.',
    onCreate: () => undefined,
  }),
);
assert.match(emptyLibrary, /graph-views-empty/);
assert.match(emptyLibrary, /This folder is empty\./);
assert.match(emptyLibrary, /Drop a view here, or create one from the graph\./);
assert.match(emptyLibrary, />Create a view</);
assert.match(emptyLibrary, /<svg/);

const quiet = renderToStaticMarkup(createElement(ViewInspectPanel, {
  view: null,
  applicationNames: {},
  onApply: () => undefined,
  onRename: () => undefined,
  onDuplicate: () => undefined,
  onDelete: () => undefined,
}));
assert.match(quiet, /graph-views-empty--quiet/);
assert.match(quiet, /Select a view to see its filters before you apply it/);
assert.match(quiet, /<svg/);

const detail = renderToStaticMarkup(createElement(ViewInspectPanel, {
  view: {
    id: 'view-1',
    name: 'Payments',
    summary: '1 filter · 2 hidden apps',
    whenLine: 'Modified 79d ago · by admin',
    hints: ['Applications = 29'],
    hiddenApplicationIds: ['app-a', 'app-b'],
  },
  applicationNames: { 'app-a': 'Billing', 'app-b': 'Ledger' },
  onApply: () => undefined,
  onRename: () => undefined,
  onDuplicate: () => undefined,
  onDelete: () => undefined,
}));
assert.match(detail, /graph-view-detail__tag/);
assert.match(detail, /Applications = 29/);
assert.doesNotMatch(detail, /<ul>[^]*Applications = 29/);
assert.match(detail, /2 hidden apps/);
assert.match(detail, />See</);
assert.match(detail, /graph-view-detail__apply/);
assert.match(detail, /graph-view-detail__actions-row/);
assert.match(detail, /is-danger-ghost/);
assert.doesNotMatch(detail, /quiet-danger/);

console.log('viewsLibraryChrome.check: ok');

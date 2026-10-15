/**
 * Runnable self-check for Custom table source and setup.
 * Run: npx --yes tsx src/features/map/components/CreateTablePanel.check.ts
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CreateTablePanel, listCustomTableMenuLabels, SHARED_TABLES_LOAD_ERROR } from './CreateTablePanel.tsx';
import { TableContentToggle } from './TableContentToggle.tsx';

Object.assign(globalThis, {
  localStorage: {
    getItem: () => JSON.stringify([
      { id: 'saved-1', name: 'Regions', row: null, column: null, label: null, color: null },
    ]),
    setItem() {},
    removeItem() {},
  },
});

const html = renderToStaticMarkup(
  createElement(CreateTablePanel, {
    nodes: [],
    applications: [],
    edges: [],
    dimensions: [],
    status: 'ready',
    exportRootRef: null,
    onViewChange: () => undefined,
  }),
);

assert.match(html, />Table setup</);
assert.doesNotMatch(html, /<details/);
assert.doesNotMatch(html, />Configuration</);
assert.doesNotMatch(html, /Saved tables/);
assert.match(html, />Source</);
assert.match(html, />New table</);
assert.match(html, />Regions</);
assert.match(html, />Rows</);
assert.match(html, />Columns</);
assert.match(html, />Label</);
assert.match(html, />Color</);
assert.match(html, />Save</);
assert.match(html, /aria-label="Table actions"/);
assert.deepEqual(listCustomTableMenuLabels(false), ['Rename', 'Share', 'Delete']);
assert.deepEqual(listCustomTableMenuLabels(true), ['Rename', 'Duplicate', 'Share', 'Delete']);
assert.doesNotMatch(html, />Delete</);
assert.equal(SHARED_TABLES_LOAD_ERROR, 'Shared tables could not be loaded.');

const ticker = renderToStaticMarkup(
  createElement(TableContentToggle, { value: 'apps', onChange: () => undefined }),
);
assert.match(ticker, />Custom table</);
assert.doesNotMatch(ticker, /Create table/);

console.log('CreateTablePanel.check: ok');

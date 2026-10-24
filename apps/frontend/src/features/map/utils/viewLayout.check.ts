/**
 * Runnable self-check for the My views list or squares choice.
 * Run: npx --yes tsx src/features/map/utils/viewLayout.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nextViewLayout, storedViewLayout } from './viewLayout.ts';

assert.equal(storedViewLayout(null), 'list');
assert.equal(storedViewLayout('list'), 'list');
assert.equal(storedViewLayout('grid'), 'grid');
assert.equal(storedViewLayout('tiles'), 'list');
assert.equal(nextViewLayout('list'), 'grid');
assert.equal(nextViewLayout('grid'), 'list');

const css = readFileSync(new URL('../../../index.css', import.meta.url), 'utf8');
assert.match(css, /\.graph-views-list\.is-grid\s*\{/);
const pane = css.match(/\.graph-views-pane\s*\{[^}]*\}/);
assert.ok(pane, 'views pane rule missing');
assert.match(pane[0], /background:\s*transparent/);
assert.doesNotMatch(pane[0], /border:\s*1px/);
assert.match(css, /\.graph-views-new:hover:not\(:disabled\)/);

console.log('viewLayout.check: ok');

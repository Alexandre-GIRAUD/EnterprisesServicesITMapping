/**
 * Application and connection drawers share one bubble width, wrap text, and resize sideways.
 * Run: npx --yes tsx src/features/map/components/detailsDrawerLayout.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../../index.css', import.meta.url), 'utf8');
const applicationDrawer = readFileSync(new URL('./ApplicationDetailsDrawer.tsx', import.meta.url), 'utf8');
const edgeDrawer = readFileSync(new URL('./EdgeDetailsDrawer.tsx', import.meta.url), 'utf8');

assert.match(css, /\.graph-details-section \{[^}]*width: 100%[^}]*overflow-wrap: anywhere/);
assert.match(css, /\.graph-details-content \{[^}]*overflow-x: hidden[^}]*overflow-y: auto/);
assert.match(css, /\.graph-details-text \{[^}]*overflow-wrap: anywhere/);
assert.match(css, /\.graph-details-drawer__grip \{[^}]*cursor: col-resize/);
assert.match(applicationDrawer, /graph-details-drawer__grip/);
assert.match(applicationDrawer, /trackDrawerResize/);
assert.match(edgeDrawer, /graph-details-drawer__grip/);
assert.match(edgeDrawer, /trackDrawerResize/);
assert.doesNotMatch(css, /\.graph-details-content \{[^}]*overflow-x: auto/);

console.log('detailsDrawerLayout.check: ok');

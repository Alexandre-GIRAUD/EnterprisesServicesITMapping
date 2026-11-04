/**
 * Sandbox Toolkit speaks in apps and flows, shows each tool as a card with an
 * icon chip and a one-line hint, and opens from a grid icon.
 * Run: npx --yes tsx src/features/map/components/workspaceDrawerToolkit.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const drawer = read('./WorkspaceDrawer.tsx');
const toolBar = read('./SelfServiceToolBar.tsx');
const canvasMenu = read('./SandboxCanvasMenu.tsx');
const css = read('../../../index.css');

assert.match(drawer, /label: 'Apps'/);
assert.match(drawer, /label: 'Flows'/);
assert.doesNotMatch(drawer, /label: 'Nodes'/);
assert.doesNotMatch(drawer, /label: 'Edges'/);
assert.doesNotMatch(drawer, /graph-drawer-action-meta">Open/);
assert.doesNotMatch(drawer, /Application node|between two nodes/);
assert.match(drawer, /hint: 'Add an app to the canvas'/);
assert.match(drawer, /graph-drawer-action--card/);
assert.match(drawer, /graph-drawer-action-chip/);

assert.match(canvasMenu, /label="Add app"/);
assert.match(canvasMenu, /label="Add flow"/);
assert.doesNotMatch(canvasMenu, /Add node|Add edge/);

assert.match(toolBar, /M12 3v17a1 1 0 0 1-1 1H5/, 'My sandboxes tab uses the grid-plus icon');

const card = css.match(/\.graph-drawer-action--card \{[^}]*\}/);
assert.ok(card, 'card rule missing');
assert.match(card[0], /border-radius: 12px/);
const chip = css.match(/\.graph-drawer-action-chip \{[^}]*\}/);
assert.ok(chip, 'chip rule missing');
assert.match(chip[0], /border-radius: 50%/);

console.log('workspaceDrawerToolkit.check: ok');

/**
 * Runnable self-check for production corrections.
 * Run: npx --yes tsx src/features/map/components/correctionsMenu.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const drawer = readFileSync(new URL('./WorkspaceDrawer.tsx', import.meta.url), 'utf8');
const canvas = readFileSync(new URL('./GraphCanvas.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../../index.css', import.meta.url), 'utf8');
const actionPadding = css.match(/\.graph-drawer-action \{[^}]*padding:\s*[^;]*\s([0-9.]+rem)/);
const embeddedTitle = css.match(/\.graph-drawer--embedded \.graph-drawer-header \{[^}]*padding-left:\s*([^;]+)/);
assert.ok(actionPadding && embeddedTitle, 'corrections title alignment rule missing');
assert.equal(embeddedTitle[1], actionPadding[1]);

assert.match(drawer, /label: 'Create App'/);
assert.match(drawer, /label: 'Create Flow'/);
assert.match(drawer, /label: 'Edit App'/);
assert.match(drawer, /label: 'Edit Flow'/);
assert.match(drawer, /title: 'Create App'/);
assert.match(drawer, /title: 'Create Flow'/);
assert.match(drawer, /title: 'Edit App'/);
assert.match(drawer, /title: 'Edit Flow'/);
assert.doesNotMatch(drawer, /Create Node|Create Edge|Add flow|Edit app|Edit flow/);
assert.match(drawer, /sandboxMode \? TOOLKIT_ACTIONS : CORRECTIONS_ACTIONS/);
assert.match(canvas, /shouldOpenInEditMode/);

console.log('correctionsMenu.check: ok');

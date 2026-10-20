/**
 * Runnable self-check for production corrections.
 * Run: npx --yes tsx src/features/map/components/correctionsMenu.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const drawer = readFileSync(new URL('./WorkspaceDrawer.tsx', import.meta.url), 'utf8');
const canvas = readFileSync(new URL('./GraphCanvas.tsx', import.meta.url), 'utf8');

assert.match(drawer, /label: 'Add'/);
assert.match(drawer, /label: 'Edit'/);
assert.match(drawer, /label: 'App'/);
assert.match(drawer, /label: 'Flow'/);
assert.match(drawer, /sandboxMode \? \(/);
assert.match(canvas, /shouldOpenInEditMode/);

console.log('correctionsMenu.check: ok');

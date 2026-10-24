/**
 * Runnable self-check for production corrections.
 * Run: npx --yes tsx src/features/map/components/correctionsMenu.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const drawer = readFileSync(new URL('./WorkspaceDrawer.tsx', import.meta.url), 'utf8');
const canvas = readFileSync(new URL('./GraphCanvas.tsx', import.meta.url), 'utf8');

assert.match(drawer, /label: 'Edit app'/);
assert.match(drawer, /label: 'Edit flow'/);
assert.match(drawer, /sandboxMode \? TOOLKIT_ACTIONS : CORRECTIONS_ACTIONS/);
assert.match(canvas, /shouldOpenInEditMode/);

console.log('correctionsMenu.check: ok');

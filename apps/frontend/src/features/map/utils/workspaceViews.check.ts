/**
 * Runnable self-check for which cartography label looks primary.
 * Run: npx --yes tsx src/features/map/utils/workspaceViews.check.ts
 */
import assert from 'node:assert/strict';
import { primaryWorkspaceMode } from './workspaceViews.ts';

assert.equal(primaryWorkspaceMode('normal', null), 'normal');
assert.equal(primaryWorkspaceMode('sandbox', null), 'sandbox');
assert.equal(primaryWorkspaceMode('normal', 'sandbox'), 'sandbox');
assert.equal(primaryWorkspaceMode('views', 'normal'), 'normal');
assert.equal(primaryWorkspaceMode('sandbox', 'sandbox'), 'sandbox');

console.log('workspaceViews.check: ok');

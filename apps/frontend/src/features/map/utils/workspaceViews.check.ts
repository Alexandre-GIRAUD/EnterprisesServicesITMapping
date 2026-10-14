/**
 * Runnable self-check for which cartography label looks primary.
 * Run: npx --yes tsx src/features/map/utils/workspaceViews.check.ts
 */
import assert from 'node:assert/strict';
import { primaryWorkspaceMode } from './workspaceViews.ts';

assert.equal(primaryWorkspaceMode('normal'), 'normal');
assert.equal(primaryWorkspaceMode('sandbox'), 'sandbox');
assert.equal(primaryWorkspaceMode('views'), 'views');

console.log('workspaceViews.check: ok');

/**
 * Runnable self-check for the collapsed workspace view switcher.
 * Run: npx --yes tsx src/features/map/utils/workspaceViews.check.ts
 */
import assert from 'node:assert/strict';
import { visibleWorkspaceViews } from './workspaceViews.ts';

const views = [
  { mode: 'normal', label: 'Production' },
  { mode: 'sandbox', label: 'Sandbox' },
  { mode: 'views', label: 'My views' },
];

assert.deepEqual(
  visibleWorkspaceViews(views, 'normal', false, false).map((view) => view.mode),
  ['normal'],
);
assert.deepEqual(
  visibleWorkspaceViews(views, 'normal', true, false).map((view) => view.mode),
  ['normal', 'sandbox', 'views'],
);
assert.deepEqual(
  visibleWorkspaceViews(views, 'sandbox', true, true).map((view) => view.mode),
  ['sandbox'],
);

console.log('workspaceViews.check: ok');

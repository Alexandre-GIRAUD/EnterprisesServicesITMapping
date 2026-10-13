/**
 * Runnable self-check for the collapsed workspace view switcher.
 * Run: npx --yes tsx src/features/map/utils/workspaceViews.check.ts
 */
import assert from 'node:assert/strict';
import { selectVisibleWorkspaceViews } from './workspaceViews.ts';

const views = [
  { mode: 'normal', label: 'Production' },
  { mode: 'sandbox', label: 'Sandbox' },
  { mode: 'views', label: 'My views' },
];

assert.deepEqual(
  selectVisibleWorkspaceViews(views, { activeMode: 'normal', isPointerInside: false, isClosedUntilLeave: false }).map((view) => view.mode),
  ['normal'],
);
assert.deepEqual(
  selectVisibleWorkspaceViews(views, { activeMode: 'normal', isPointerInside: true, isClosedUntilLeave: false }).map((view) => view.mode),
  ['normal', 'sandbox', 'views'],
);
assert.deepEqual(
  selectVisibleWorkspaceViews(views, { activeMode: 'sandbox', isPointerInside: true, isClosedUntilLeave: true }).map((view) => view.mode),
  ['sandbox'],
);

console.log('workspaceViews.check: ok');

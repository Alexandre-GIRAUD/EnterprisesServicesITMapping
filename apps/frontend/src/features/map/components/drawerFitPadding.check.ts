/**
 * Runnable self-check: the graph is fitted beside a drawer, not under it.
 * Run: npx --yes tsx src/features/map/components/drawerFitPadding.check.ts
 */
import assert from 'node:assert/strict';
import {
  DETAILS_DRAWER_WIDTH_PX,
  DRAWER_FIT_GAP_PX,
  MODULE_DRAWER_WIDTH_PX,
  drawerFitPadding,
} from './drawerFitPadding.ts';

assert.equal(typeof drawerFitPadding(false), 'number');
const open = drawerFitPadding(true);
assert.equal(typeof open, 'object');
assert.equal((open as { right: string }).right, `${MODULE_DRAWER_WIDTH_PX + DRAWER_FIT_GAP_PX}px`);
assert.ok(MODULE_DRAWER_WIDTH_PX + DRAWER_FIT_GAP_PX >= 452, 'wider than the 440px drawer plus its margin');

// The drawer width comes from the caller: a resized drawer or the 420px details drawer.
assert.equal((drawerFitPadding(true, 2000, 600) as { right: string }).right, `${600 + DRAWER_FIT_GAP_PX}px`);
assert.equal(
  (drawerFitPadding(true, 2000, DETAILS_DRAWER_WIDTH_PX) as { right: string }).right,
  `${DETAILS_DRAWER_WIDTH_PX + DRAWER_FIT_GAP_PX}px`,
);

// A narrow pane keeps room for the graph.
assert.equal((drawerFitPadding(true, 500) as { right: string }).right, '300px');
assert.equal((drawerFitPadding(true, 500, 200) as { right: string }).right, `${200 + DRAWER_FIT_GAP_PX}px`);

console.log('drawerFitPadding.check: ok');

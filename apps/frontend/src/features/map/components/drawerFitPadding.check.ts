/**
 * Runnable self-check: the graph is fitted beside a drawer, not under it.
 * Run: npx --yes tsx src/features/map/components/drawerFitPadding.check.ts
 */
import assert from 'node:assert/strict';
import {
  LEGEND_FIT_GAP_PX,
  computeLegendFitPadding,
  DETAILS_DRAWER_WIDTH_PX,
  DRAWER_FIT_GAP_PX,
  MODULE_DRAWER_WIDTH_PX,
  computeDrawerFitPadding,
} from './drawerFitPadding.ts';

assert.equal(typeof computeDrawerFitPadding(false), 'number');
const open = computeDrawerFitPadding(true);
assert.equal(typeof open, 'object');
assert.equal((open as { right: string }).right, `${MODULE_DRAWER_WIDTH_PX + DRAWER_FIT_GAP_PX}px`);
assert.ok(MODULE_DRAWER_WIDTH_PX + DRAWER_FIT_GAP_PX >= 452, 'wider than the 440px drawer plus its margin');

// The drawer width comes from the caller: a resized drawer or the 420px details drawer.
assert.equal((computeDrawerFitPadding(true, { paneWidthPx: 2000, drawerWidthPx: 600 }) as { right: string }).right, `${600 + DRAWER_FIT_GAP_PX}px`);
assert.equal(
  (computeDrawerFitPadding(true, { paneWidthPx: 2000, drawerWidthPx: DETAILS_DRAWER_WIDTH_PX }) as { right: string }).right,
  `${DETAILS_DRAWER_WIDTH_PX + DRAWER_FIT_GAP_PX}px`,
);

// A narrow pane keeps room for the graph.
assert.equal((computeDrawerFitPadding(true, { paneWidthPx: 500 }) as { right: string }).right, '300px');
assert.equal((computeDrawerFitPadding(true, { paneWidthPx: 500, drawerWidthPx: 200 }) as { right: string }).right, `${200 + DRAWER_FIT_GAP_PX}px`);

// The legend sits over the pane's left edge: the graph is fitted to its right.
assert.equal(computeLegendFitPadding(undefined), 0.15);
assert.equal((computeLegendFitPadding(200) as { left: string }).left, );
assert.equal((computeLegendFitPadding(200) as { top: number }).top, 0.15);

console.log('drawerFitPadding.check: ok');

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
  computeFitAreaAspectRatio,
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
assert.equal(computeLegendFitPadding(undefined), 0.06);
assert.equal((computeLegendFitPadding(200) as { left: string }).left, `${200 + LEGEND_FIT_GAP_PX}px`);
assert.equal((computeLegendFitPadding(200) as { top: number }).top, 0.06);

// The open side menu floats over the right edge: the graph is fitted to its left.
assert.equal((computeLegendFitPadding(200, 360) as { right: string }).right, '384px');
assert.equal((computeLegendFitPadding(undefined, 360) as { right: string }).right, '384px');
assert.equal((computeLegendFitPadding(undefined, 360) as { left: number }).left, 0.06);
assert.equal((computeLegendFitPadding(200) as { right: number }).right, 0.06);

// On a narrow pane the legend and menu insets give way to the plain margin so the graph keeps room.
assert.equal(computeLegendFitPadding(200, 360, 500), 0.06);
assert.equal((computeLegendFitPadding(200, 360, 1200) as { left: string }).left, '224px');

// Islands are packed for the area the fit really uses: the pane minus its margins, legend and menu.
assert.equal(computeFitAreaAspectRatio(800, 600, 0.06), 800 / 600);
assert.equal(computeFitAreaAspectRatio(800, 600, { top: 0.06, bottom: 0.06, left: '300px', right: 0.06 }), 452 / 528);
assert.equal(computeFitAreaAspectRatio(0, 600, 0.06), undefined);

console.log('drawerFitPadding.check: ok');

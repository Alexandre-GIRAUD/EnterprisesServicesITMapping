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
  computeChromeFitPadding,
  TITLE_FIT_GAP_PX,
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
assert.equal(computeLegendFitPadding(), 0.06);
assert.equal((computeLegendFitPadding({ legendRightPx: 200 }) as { left: string }).left, `${200 + LEGEND_FIT_GAP_PX}px`);
assert.equal((computeLegendFitPadding({ legendRightPx: 200 }) as { top: number }).top, 0.06);

// The open side menu floats over the right edge: the graph is fitted to its left.
assert.equal((computeLegendFitPadding({ legendRightPx: 200, menuWidthPx: 360 }) as { right: string }).right, '384px');
assert.equal((computeLegendFitPadding({ menuWidthPx: 360 }) as { right: string }).right, '384px');
assert.equal((computeLegendFitPadding({ menuWidthPx: 360 }) as { left: number }).left, 0.06);
assert.equal((computeLegendFitPadding({ legendRightPx: 200 }) as { right: number }).right, 0.06);

// On a narrow pane the legend and menu insets give way to the plain margin so the graph keeps room.
assert.equal(computeLegendFitPadding({ legendRightPx: 200, menuWidthPx: 360, paneWidthPx: 500 }), 0.06);
assert.equal((computeLegendFitPadding({ legendRightPx: 200, menuWidthPx: 360, paneWidthPx: 1200 }) as { left: string }).left, '224px');

// The header floating over the top edge pushes the fitted graph down, in Cartography too.
assert.equal((computeLegendFitPadding({ paneWidthPx: 1200, headerBottomPx: 70 }) as { top: string }).top, `${70 + TITLE_FIT_GAP_PX}px`);
assert.equal((computeLegendFitPadding({ legendRightPx: 200, paneWidthPx: 1200, headerBottomPx: 70 }) as { left: string }).left, '224px');
assert.equal(computeLegendFitPadding({ paneWidthPx: 1200, headerBottomPx: 0 }), 0.06);

// Islands are packed for the area the fit really uses: the pane minus its margins, legend and menu.
assert.equal(computeFitAreaAspectRatio(800, 600, 0.06), 800 / 600);
assert.equal(computeFitAreaAspectRatio(800, 600, { top: 0.06, bottom: 0.06, left: '300px', right: 0.06 }), 452 / 528);
assert.equal(computeFitAreaAspectRatio(0, 600, 0.06), undefined);

// A sandbox is fitted below its floating title and beside the legend that overlaps it.
const pane = { left: 100, top: 50, right: 900, bottom: 650 };
assert.deepEqual(computeChromeFitPadding(pane, null, null), { top: 0.06, bottom: 0.06, left: 0.06, right: 0.06 });
const titled = computeChromeFitPadding(pane, { left: 400, top: 60, right: 600, bottom: 96 }, null) as { top: string };
assert.equal(titled.top, `${96 - 50 + TITLE_FIT_GAP_PX}px`);
const legendBeside = computeChromeFitPadding(pane, null, { left: 110, top: 100, right: 330, bottom: 400 }) as { left: string };
assert.equal(legendBeside.left, `${330 - 100 + LEGEND_FIT_GAP_PX}px`);
// A legend over another sandbox, or folded into its small square far from the pane, leaves this one alone.
const elsewhere = computeChromeFitPadding(pane, null, { left: 10, top: 100, right: 90, bottom: 400 }) as { left: number };
assert.equal(elsewhere.left, 0.06);
// Chrome taking most of a small pane gives way to the plain margin.
const crowded = computeChromeFitPadding(pane, { left: 400, top: 60, right: 600, bottom: 560 }, null) as { top: number };
assert.equal(crowded.top, 0.06);

console.log('drawerFitPadding.check: ok');

/**
 * Legend frame shape: entry direction, label scale, drag clamp.
 * Run: npx --yes tsx src/features/map/components/legendFrame.check.ts
 */
import assert from 'node:assert/strict';
import {
  DEFAULT_LEGEND_WIDTH_PX,
  LEGEND_CONTROLS_CLEARANCE_PX,
  chooseLegendEntryDirection,
  clampLegendOffset,
  fillLegendFrame,
  fitLegendHeight,
  measureLegendFontScale,
  pickShownLegendFrame,
  LEGEND_MIN_HEIGHT_PX,
  LEGEND_MIN_WIDTH_PX,
  isResizeGrip,
  snugLegendSize,
} from './legendFrame.ts';

assert.equal(DEFAULT_LEGEND_WIDTH_PX, 220);

assert.equal(chooseLegendEntryDirection(400, 150), 'row');
assert.equal(chooseLegendEntryDirection(400, 200), 'row');
assert.equal(chooseLegendEntryDirection(264, 360), 'column');
assert.equal(chooseLegendEntryDirection(500, 400), 'column');
assert.equal(chooseLegendEntryDirection(399, 200), 'column');
assert.equal(chooseLegendEntryDirection(400, 0), 'column');

assert.equal(measureLegendFontScale(264, 360), 1);
assert.equal(measureLegendFontScale(500, 400), 1);
assert.equal(measureLegendFontScale(400, 150), 0.65);
assert.equal(measureLegendFontScale(200, 200), 0.7575757575757576);
assert.equal(measureLegendFontScale(0, 100), 0.65);

assert.deepEqual(
  clampLegendOffset({ left: 100, top: 100 }, { width: 264, height: 360 }, { width: 800, height: 600 }),
  { left: 100, top: 100 },
);
assert.deepEqual(
  clampLegendOffset({ left: 900, top: 900 }, { width: 264, height: 360 }, { width: 800, height: 600 }),
  { left: 536, top: 240 },
);
assert.deepEqual(
  clampLegendOffset({ left: -20, top: -5 }, { width: 264, height: 360 }, { width: 800, height: 600 }),
  { left: 0, top: 0 },
);
assert.deepEqual(
  clampLegendOffset({ left: 50, top: 50 }, { width: 900, height: 700 }, { width: 800, height: 600 }),
  { left: 0, top: 0 },
);
assert.deepEqual(
  clampLegendOffset(
    { left: -20, top: -5 },
    { width: 264, height: 360 },
    { width: 800, height: 600, insetLeft: 15, insetTop: 15 },
  ),
  { left: -15, top: -5 },
);
assert.deepEqual(
  clampLegendOffset(
    { left: 900, top: 900 },
    { width: 264, height: 360 },
    { width: 800, height: 600, insetLeft: 15, insetTop: 15 },
  ),
  { left: 521, top: 225 },
);

// Default height leaves the zoom controls (bottom-left) uncovered.
assert.equal(fitLegendHeight(360, 900), 360);
assert.equal(fitLegendHeight(360, 400), 400 - 10 - LEGEND_CONTROLS_CLEARANCE_PX);
assert.equal(fitLegendHeight(360, 100), 80);
// A measured clearance (the real controls height) replaces the default one.
assert.equal(fitLegendHeight(360, 400, 200), 400 - 10 - 200);
assert.equal(fitLegendHeight(100, 400, 200), 100);

// Edit mode fills the pane, keeping a margin so the pane borders stay visible.
assert.deepEqual(
  fillLegendFrame({ width: 800, height: 600, insetLeft: 10, insetTop: 10 }, 8),
  { offset: { left: -2, top: -2 }, size: { width: 784, height: 584 } },
);
assert.deepEqual(
  fillLegendFrame({ width: 800, height: 600 }, 8),
  { offset: { left: 8, top: 8 }, size: { width: 784, height: 584 } },
);

// Leaving edit mode shows the own frame again, even while the stale fill is still stored.
const ownFrame = { offset: { left: 4, top: 6 }, size: { width: 220, height: 360 } };
const staleFill = { offset: { left: 8, top: 8 }, size: { width: 784, height: 584 } };
assert.deepEqual(pickShownLegendFrame(true, staleFill, ownFrame), staleFill);
assert.deepEqual(pickShownLegendFrame(false, staleFill, ownFrame), ownFrame);
assert.deepEqual(pickShownLegendFrame(true, null, ownFrame), ownFrame);

// The default frame is the snuggest one: narrowest that cuts nothing, then shortest at that width.
{
  const content = { width: 150, height: 200 };
  const measure = (frame: { width: number; height: number }) => ({
    scrollWidth: Math.max(frame.width, content.width),
    scrollHeight: Math.max(frame.height, content.height),
  });
  assert.deepEqual(snugLegendSize(measure, { width: 800, height: 600 }), { width: 150, height: 200 });
  assert.deepEqual(snugLegendSize(measure, { width: 140, height: 150 }), { width: 140, height: 150 });
  // Content smaller than the minimum frame keeps the minimum.
  assert.deepEqual(snugLegendSize(() => ({ scrollWidth: 10, scrollHeight: 10 }), { width: 800, height: 600 }), {
    width: LEGEND_MIN_WIDTH_PX,
    height: LEGEND_MIN_HEIGHT_PX,
  });
  // A layout that needs more width once the frame is taller grows the frame until nothing is cut.
  const reflowing = (frame: { width: number; height: number }) => ({
    scrollWidth: Math.max(frame.width, frame.height > 120 ? 180 : 150),
    scrollHeight: Math.max(frame.height, 200),
  });
  assert.deepEqual(snugLegendSize(reflowing, { width: 800, height: 600 }), { width: 180, height: 200 });
}

// Only the bottom-right corner is the native resize grip.
assert.equal(isResizeGrip({ right: 400, bottom: 300 }, 395, 295), true);
assert.equal(isResizeGrip({ right: 400, bottom: 300 }, 300, 295), false);
assert.equal(isResizeGrip({ right: 400, bottom: 300 }, 395, 100), false);

console.log('legendFrame.check: ok');

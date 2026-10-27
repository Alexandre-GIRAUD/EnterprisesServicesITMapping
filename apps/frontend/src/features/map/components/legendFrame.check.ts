/**
 * Legend frame shape: entry direction, label scale, drag clamp.
 * Run: npx --yes tsx src/features/map/components/legendFrame.check.ts
 */
import assert from 'node:assert/strict';
import { chooseLegendEntryDirection, clampLegendOffset, measureLegendFontScale } from './legendFrame.ts';

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

console.log('legendFrame.check: ok');

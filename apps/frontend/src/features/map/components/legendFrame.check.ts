/**
 * Legend frame shape: entry direction, label scale, drag clamp.
 * Run: npx --yes tsx src/features/map/components/legendFrame.check.ts
 */
import assert from 'node:assert/strict';
import { clampLegendOffset, legendEntryDirection, legendFontScale } from './legendFrame.ts';

assert.equal(legendEntryDirection(400, 150), 'row');
assert.equal(legendEntryDirection(400, 200), 'row');
assert.equal(legendEntryDirection(264, 360), 'column');
assert.equal(legendEntryDirection(500, 400), 'column');
assert.equal(legendEntryDirection(399, 200), 'column');
assert.equal(legendEntryDirection(400, 0), 'column');

assert.equal(legendFontScale(264, 360), 1);
assert.equal(legendFontScale(500, 400), 1);
assert.equal(legendFontScale(400, 150), 0.65);
assert.equal(legendFontScale(200, 200), 0.7575757575757576);
assert.equal(legendFontScale(0, 100), 0.65);

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

console.log('legendFrame.check: ok');

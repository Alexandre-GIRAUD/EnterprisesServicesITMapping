/**
 * Runnable self-check for legend reflow.
 * Run: npx --yes tsx src/features/map/components/legendFit.check.ts
 */
import assert from 'node:assert/strict';
import { legendColumnCount, nextLegendFontPx } from './legendFit.ts';

assert.equal(legendColumnCount(200), 1);
assert.equal(legendColumnCount(260), 2);
assert.equal(legendColumnCount(440), 3);
assert.equal(nextLegendFontPx(12, true), 11.5);
assert.equal(nextLegendFontPx(9, true), 9);
assert.equal(nextLegendFontPx(12, false), 12);

console.log('legendFit.check: ok');

/**
 * The first fit must not be lost when React Flow has not given its instance yet.
 * Run: npx --yes tsx src/features/map/components/fitGraphView.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fitGraphViewWhenReady } from './fitGraphView.ts';

const frames: Array<() => void> = [];
Object.assign(globalThis, {
  requestAnimationFrame: (callback: () => void) => frames.push(callback),
});
function runFrames(count: number): void {
  for (let step = 0; step < count && frames.length > 0; step += 1) frames.shift()?.();
}

const fitted: unknown[] = [];
let isMeasured = false;
const instance = {
  fitView: (options: unknown) => void fitted.push(options),
  getNodes: () => [{ id: 'a', position: { x: 0, y: 0 }, measured: isMeasured ? { width: 160, height: 48 } : {} }],
};
const ref: { current: typeof instance | null } = { current: null };

fitGraphViewWhenReady(ref, { duration: 0 });
runFrames(3);
assert.equal(fitted.length, 0, 'nothing to fit while the instance is missing');

ref.current = instance;
runFrames(10);
assert.equal(fitted.length, 0, 'nothing to fit while the boxes are not measured');

isMeasured = true;
runFrames(10);
assert.equal(fitted.length, 1, 'fits once the instance shows up and its boxes are measured');

const giveUp: { current: typeof instance | null } = { current: null };
fitGraphViewWhenReady(giveUp);
runFrames(1000);
assert.equal(frames.length, 0, 'stops waiting for an instance that never comes');

assert.match(
  readFileSync(new URL('../hooks/useGraphData.ts', import.meta.url), 'utf8'),
  /fitGraphViewWhenReady\(rfRef\)/,
);
assert.match(
  readFileSync(new URL('./useLegendFrame.ts', import.meta.url), 'utf8'),
  /element\.style\.overflow = 'hidden'/,
);

console.log('fitGraphView.check: ok');

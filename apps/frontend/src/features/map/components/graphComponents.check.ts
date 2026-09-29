/**
 * Runnable self-check for dashed zones around disconnected diagrams.
 * Run: npx --yes tsx src/features/map/components/graphComponents.check.ts
 */
import assert from 'node:assert/strict';
import { componentZoneFrames } from './graphComponents.ts';

const left = { id: 'a', position: { x: 0, y: 10 }, width: 160, height: 48 };
const right = { id: 'b', position: { x: 400, y: 10 }, width: 160, height: 48 };

assert.deepEqual(componentZoneFrames([left], []), []);
assert.deepEqual(componentZoneFrames([left, right], [{ source: 'a', target: 'b' }]), []);

const frames = componentZoneFrames([left, right], []);
assert.equal(frames.length, 2);
assert.deepEqual(frames[0], { x: -28, y: -18, width: 216, height: 104 });
assert.deepEqual(frames[1], { x: 372, y: -18, width: 216, height: 104 });

console.log('graphComponents.check: ok');

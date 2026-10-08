/**
 * Runnable self-check for dashed zones around disconnected diagrams.
 * Run: npx --yes tsx src/features/map/components/graphComponents.check.ts
 */
import assert from 'node:assert/strict';
import { componentZoneFrames, packComponentOffsets } from './graphComponents.ts';

const left = { id: 'a', position: { x: 0, y: 10 }, width: 160, height: 48 };
const right = { id: 'b', position: { x: 400, y: 10 }, width: 160, height: 48 };

assert.deepEqual(componentZoneFrames([left], []), []);
assert.deepEqual(componentZoneFrames([left, right], [{ source: 'a', target: 'b' }]), []);

const frames = componentZoneFrames([left, right], []);
assert.equal(frames.length, 2);
assert.deepEqual(frames[0], { x: -28, y: -18, width: 216, height: 104 });
assert.deepEqual(frames[1], { x: 372, y: -18, width: 216, height: 104 });

const box = { width: 200, height: 100 };
assert.deepEqual(packComponentOffsets([box], 140, 2), [{ x: 0, y: 0 }]);

const wide = packComponentOffsets([box, box], 140, 3);
assert.equal(wide[0]?.y, wide[1]?.y);
assert.ok((wide[1]?.x ?? 0) >= box.width + 28 * 2 + 8);

const tall = packComponentOffsets([box, box], 140, 0.25);
assert.equal(tall[0]?.x, tall[1]?.x);
assert.ok((tall[1]?.y ?? 0) >= box.height + 28 * 2 + 8);

const square = packComponentOffsets([box, box, box], 140, 1);
const rows = new Set(square.map((offset) => offset.y));
assert.ok(rows.size > 1);

const many = Array.from({ length: 40 }, () => ({ width: 400, height: 200 }));
const packed = packComponentOffsets(many, 140, 16 / 9);
const maxX = Math.max(...packed.map((offset) => offset.x));
const maxY = Math.max(...packed.map((offset) => offset.y));
assert.ok(Number.isFinite(maxX) && Number.isFinite(maxY));
assert.ok(maxX < 40 * 400 * 4);
assert.ok(maxY < 40 * 200 * 4);

console.log('graphComponents.check: ok');

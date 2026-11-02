/**
 * A node restored by the automatic layout never lands inside another island.
 * Run: npx --yes tsx src/features/map/components/islandOverlap.check.ts
 */
import assert from 'node:assert/strict';
import { clearNewNodesOfOtherIslands, componentZoneFrames } from './graphComponents.ts';

const size = { width: 160, height: 48 };
const positions = {
  a: { x: 0, y: 0 },
  b: { x: 300, y: 0 },
  c: { x: 300, y: 60 },
  d: { x: 160 + 40, y: 0 }, // restored next to a, but on top of the b-c island
};
const edges = [
  { source: 'b', target: 'c' },
  { source: 'a', target: 'd' },
];
const cleared = clearNewNodesOfOtherIslands(positions, ['d'], edges, size);
assert.deepEqual(cleared.a, positions.a);
assert.deepEqual(cleared.b, positions.b);
assert.deepEqual(cleared.c, positions.c);

const nodes = Object.entries(cleared).map(([id, position]) => ({ id, position, ...size }));
const frames = componentZoneFrames(nodes, edges);
assert.equal(frames.length, 2);
const [f, g] = frames;
const apart = f.x + f.width <= g.x || g.x + g.width <= f.x || f.y + f.height <= g.y || g.y + g.height <= f.y;
assert.ok(apart, 'island frames must not overlap');

// An island that already overlaps another (a manual drag) is left alone.
const dragged = { a: { x: 0, y: 0 }, b: { x: 50, y: 20 } };
assert.deepEqual(clearNewNodesOfOtherIslands(dragged, [], [], size), dragged);

console.log('islandOverlap.check: ok');

/**
 * Moving one box only makes the arrows attached to it stale.
 * Run: npx --yes tsx src/features/map/components/staleEdges.check.ts
 */
import assert from 'node:assert/strict';
import type { Rect } from './elkLayout.ts';
import { findStaleEdgeIds } from './staleEdges.ts';

const edge = (id: string, source: string, target: string, from: [number, number], to: [number, number]) => ({
  id,
  source,
  target,
  data: { routeStart: { x: from[0], y: from[1] }, routeEnd: { x: to[0], y: to[1] } },
});

const edges = [
  edge('ab', 'a', 'b', [100, 30], [200, 30]),
  edge('bc', 'b', 'c', [250, 60], [250, 140]),
  edge('cd', 'c', 'd', [300, 170], [400, 170]),
];
const rects = new Map<string, Rect>([
  ['a', { x: 0, y: 0, width: 100, height: 60 }],
  ['b', { x: 200, y: 0, width: 100, height: 60 }],
  ['c', { x: 200, y: 140, width: 100, height: 60 }],
  ['d', { x: 400, y: 140, width: 100, height: 60 }],
]);

assert.deepEqual([...findStaleEdgeIds(edges, rects)], []);

rects.set('a', { x: 0, y: 300, width: 100, height: 60 });
assert.deepEqual([...findStaleEdgeIds(edges, rects)], ['ab']);

rects.set('c', { x: 200, y: 400, width: 100, height: 60 });
assert.deepEqual([...findStaleEdgeIds(edges, rects)].sort(), ['ab', 'bc', 'cd']);

console.log('staleEdges.check: ok');

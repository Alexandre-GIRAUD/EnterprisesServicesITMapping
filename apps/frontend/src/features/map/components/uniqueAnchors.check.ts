/**
 * No two arrow endpoints share an anchor point on the same node side.
 * Run: npx --yes tsx src/features/map/components/uniqueAnchors.check.ts
 */
import assert from 'node:assert/strict';
import { buildLiveRoutes, type Rect } from './elkLayout.ts';

const rectById = new Map<string, Rect>([
  ['a', { x: 0, y: 0, width: 100, height: 60 }],
  ['b', { x: 200, y: 0, width: 100, height: 60 }],
  ['c', { x: 200, y: 80, width: 100, height: 60 }],
]);

const routes = buildLiveRoutes(
  [
    { id: 'e1', source: 'a', target: 'b' },
    { id: 'e2', source: 'a', target: 'c' },
  ],
  rectById,
);

const startA = [...routes.values()].map((points) => points[0]);
assert.equal(startA.length, 2);
assert.ok(
  Math.abs(startA[0].x - startA[1].x) > 0.5 || Math.abs(startA[0].y - startA[1].y) > 0.5,
  'two arrows leaving A must not share the same anchor point',
);

// Both leave the right side of A (same node side, distinct points).
assert.ok(startA.every((point) => Math.abs(point.x - 100) < 0.5));
assert.ok(Math.abs(startA[0].y - startA[1].y) >= 1);

console.log('uniqueAnchors.check: ok');

/**
 * Arrow routes prefer fewer bends over a shorter length.
 * Run: npx --yes tsx src/features/map/components/fewerBends.check.ts
 */
import assert from 'node:assert/strict';
import { buildLiveRoutes, type Rect } from './elkLayout.ts';

// The shortest side pair (right to left) needs a Z with two bends;
// right to top reaches the same box with a single bend.
const rectById = new Map<string, Rect>([
  ['a', { x: 0, y: 0, width: 100, height: 60 }],
  ['b', { x: 150, y: 100, width: 100, height: 60 }],
]);
const route = buildLiveRoutes([{ id: 'e', source: 'a', target: 'b' }], rectById).get('e');
assert.ok(route);
assert.equal(route.length, 3, 'one bend (three points), not a Z shape');

// A straight link stays straight.
const aligned = new Map<string, Rect>([
  ['a', { x: 0, y: 0, width: 100, height: 60 }],
  ['b', { x: 200, y: 0, width: 100, height: 60 }],
]);
assert.equal(buildLiveRoutes([{ id: 'e', source: 'a', target: 'b' }], aligned).get('e')?.length, 2);

console.log('fewerBends.check: ok');

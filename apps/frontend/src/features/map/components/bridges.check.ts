/**
 * Stacked orthogonal arrows separate; a real crossing still hops.
 * Run: npx --yes tsx src/features/map/components/bridges.check.ts
 */
import assert from 'node:assert/strict';
import { LANE_GAP, computeBridges, spreadStackedRoutes } from './bridges.ts';

const stacked = new Map([
  ['a', [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 100 },
    { x: 40, y: 100 },
  ]],
  ['b', [
    { x: 0, y: 20 },
    { x: 10, y: 20 },
    { x: 10, y: 80 },
    { x: 40, y: 80 },
  ]],
]);

const spread = spreadStackedRoutes(stacked);
const laneA = spread.get('a');
const laneB = spread.get('b');
assert.ok(laneA && laneB);
assert.equal(laneA[0].x, 0);
assert.equal(laneA[0].y, 0);
assert.equal(laneB[0].x, 0);
assert.equal(laneB[0].y, 20);
assert.equal(laneA[1].x, laneA[2].x);
assert.equal(laneB[1].x, laneB[2].x);
assert.ok(Math.abs(laneA[1].x - laneB[1].x) >= LANE_GAP);
assert.equal(laneA[3].x, 40);
assert.equal(laneA[3].y, 100);
assert.equal(laneB[3].x, 40);
assert.equal(laneB[3].y, 80);

const direct = new Map([
  ['a', [{ x: 10, y: 0 }, { x: 10, y: 120 }]],
  ['b', [{ x: 10, y: 0 }, { x: 10, y: 120 }]],
]);
const directSpread = spreadStackedRoutes(direct);
const directB = directSpread.get('b');
assert.ok(directB);
assert.equal(directB[0].x, 10);
assert.equal(directB[directB.length - 1].x, 10);
assert.ok(directB.some((point) => Math.abs(point.x - 10) >= LANE_GAP));

const crossing = new Map([
  ['h', [
    { x: 0, y: 50 },
    { x: 20, y: 50 },
    { x: 100, y: 50 },
    { x: 120, y: 50 },
  ]],
  ['v', [
    { x: 60, y: 0 },
    { x: 60, y: 20 },
    { x: 60, y: 80 },
    { x: 60, y: 100 },
  ]],
]);
const hops = computeBridges(spreadStackedRoutes(crossing));
const bridge = hops.get('h') ?? [];
assert.equal(bridge.length, 1);
assert.equal(bridge[0].x, 60);
assert.equal(bridge[0].y, 50);

console.log('bridges.check: ok');

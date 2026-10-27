/**
 * Automatic application placement keeps flows orthogonal and clear.
 * Run: npx --yes tsx src/features/map/components/clearFlowPlacement.check.ts
 */
import assert from 'node:assert/strict';
import { placeClearFlows, type FlowPoint } from './clearFlowPlacement.ts';

const nodeSize = { width: 160, height: 48 };

function nodes(ids: string[]) {
  return ids.map((id) => ({ id, ...nodeSize }));
}

function isOrthogonal(points: FlowPoint[]): boolean {
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const horizontal = Math.abs(previous.y - current.y) < 0.5;
    const vertical = Math.abs(previous.x - current.x) < 0.5;
    if (!horizontal && !vertical) return false;
  }
  return points.length >= 2;
}

function bendCount(points: FlowPoint[]): number {
  let bends = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const sameX = Math.abs(previous.x - current.x) < 0.5 && Math.abs(current.x - next.x) < 0.5;
    const sameY = Math.abs(previous.y - current.y) < 0.5 && Math.abs(current.y - next.y) < 0.5;
    if (!sameX && !sameY) bends += 1;
  }
  return bends;
}

function segments(points: FlowPoint[]) {
  const result: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    result.push({
      x1: points[index].x,
      y1: points[index].y,
      x2: points[index + 1].x,
      y2: points[index + 1].y,
    });
  }
  return result;
}

function rangesOverlap(a1: number, a2: number, b1: number, b2: number): boolean {
  const start = Math.max(Math.min(a1, a2), Math.min(b1, b2));
  const end = Math.min(Math.max(a1, a2), Math.max(b1, b2));
  return end - start > 0.5;
}

function routesShareStretch(routes: Map<string, FlowPoint[]>): boolean {
  const all = [...routes.entries()].flatMap(([id, points]) =>
    segments(points).map((segment) => ({ id, ...segment })),
  );
  for (let left = 0; left < all.length; left += 1) {
    for (let right = left + 1; right < all.length; right += 1) {
      const a = all[left];
      const b = all[right];
      if (a.id === b.id) continue;
      const bothHorizontal = Math.abs(a.y1 - a.y2) < 0.5 && Math.abs(b.y1 - b.y2) < 0.5;
      const bothVertical = Math.abs(a.x1 - a.x2) < 0.5 && Math.abs(b.x1 - b.x2) < 0.5;
      if (bothHorizontal && Math.abs(a.y1 - b.y1) < 0.5 && rangesOverlap(a.x1, a.x2, b.x1, b.x2)) {
        return true;
      }
      if (bothVertical && Math.abs(a.x1 - b.x1) < 0.5 && rangesOverlap(a.y1, a.y2, b.y1, b.y2)) {
        return true;
      }
    }
  }
  return false;
}

function crossingCount(routes: Map<string, FlowPoint[]>): number {
  const all = [...routes.entries()].flatMap(([id, points]) =>
    segments(points).map((segment) => ({ id, ...segment })),
  );
  let count = 0;
  for (const horizontal of all) {
    if (Math.abs(horizontal.y1 - horizontal.y2) >= 0.5) continue;
    for (const vertical of all) {
      if (horizontal.id === vertical.id) continue;
      if (Math.abs(vertical.x1 - vertical.x2) >= 0.5) continue;
      const x = vertical.x1;
      const y = horizontal.y1;
      const insideHorizontal = x > Math.min(horizontal.x1, horizontal.x2) + 0.5
        && x < Math.max(horizontal.x1, horizontal.x2) - 0.5;
      const insideVertical = y > Math.min(vertical.y1, vertical.y2) + 0.5
        && y < Math.max(vertical.y1, vertical.y2) - 0.5;
      if (insideHorizontal && insideVertical) count += 1;
    }
  }
  return count;
}

function assertClear(routes: Map<string, FlowPoint[]>, hops: Map<string, FlowPoint[]>) {
  for (const points of routes.values()) {
    assert.equal(isOrthogonal(points), true);
    assert.ok(bendCount(points) <= 1);
  }
  assert.equal(routesShareStretch(routes), false);
  assert.equal(crossingCount(routes), 0);
  assert.equal([...hops.values()].every((points) => points.length === 0), true);
}

const chain = placeClearFlows(nodes(['a', 'b', 'c']), [
  { id: 'ab', source: 'a', target: 'b' },
  { id: 'bc', source: 'b', target: 'c' },
]);
assertClear(chain.routes, chain.hops);
const top = chain.positions.get('a');
const middle = chain.positions.get('b');
const bottom = chain.positions.get('c');
assert.ok(top && middle && bottom);
assert.ok(middle.y >= top.y + nodeSize.height);
assert.ok(bottom.y >= middle.y + nodeSize.height);
assert.equal(Math.abs(top.x - middle.x) < 0.5, true);
assert.equal(bendCount(chain.routes.get('ab') ?? []), 0);
assert.equal(bendCount(chain.routes.get('bc') ?? []), 0);

const crossed = placeClearFlows(nodes(['a', 'b', 'c', 'd']), [
  { id: 'ad', source: 'a', target: 'd' },
  { id: 'bc', source: 'b', target: 'c' },
]);
assertClear(crossed.routes, crossed.hops);

const parallel = placeClearFlows(nodes(['a', 'b']), [
  { id: 'one', source: 'a', target: 'b' },
  { id: 'two', source: 'a', target: 'b' },
]);
assertClear(parallel.routes, parallel.hops);
const firstStart = parallel.routes.get('one')?.[0];
const secondStart = parallel.routes.get('two')?.[0];
assert.ok(firstStart && secondStart);
assert.equal(
  Math.abs(firstStart.x - secondStart.x) < 0.5 && Math.abs(firstStart.y - secondStart.y) < 0.5,
  false,
);

const forced = placeClearFlows(
  nodes(['a', 'b', 'c', 'd', 'e', 'f']),
  [
    ['a', 'd'],
    ['a', 'e'],
    ['a', 'f'],
    ['b', 'd'],
    ['b', 'e'],
    ['b', 'f'],
    ['c', 'd'],
    ['c', 'e'],
    ['c', 'f'],
  ].map(([source, target], index) => ({ id: `k${index}`, source, target })),
);
for (const points of forced.routes.values()) {
  assert.equal(isOrthogonal(points), true);
  assert.ok(bendCount(points) <= 1);
}
assert.equal(routesShareStretch(forced.routes), false);
assert.ok(crossingCount(forced.routes) > 0);
assert.ok([...forced.hops.values()].some((points) => points.length > 0));

console.log('clearFlowPlacement.check: ok');

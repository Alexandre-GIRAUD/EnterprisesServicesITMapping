/**
 * Arrows touch their box outlines, never pass over a box, point into their target,
 * and a re-routed arrow crosses as few other arrows as possible.
 * Run: npx --yes tsx src/features/map/components/arrowRouting.check.ts
 */
import assert from 'node:assert/strict';
import { buildLiveRoutes, type Point, type Rect } from './elkLayout.ts';
import { routeProblems } from './routeRules.ts';

const box = (x: number, y: number): Rect => ({ x, y, width: 160, height: 48 });

// A wall sits between two boxes on the same row.
const wall = new Map<string, Rect>([
  ['a', box(0, 0)],
  ['wall', { x: 300, y: -200, width: 40, height: 450 }],
  ['b', box(600, 0)],
]);
const walled = buildLiveRoutes([{ id: 'e', source: 'a', target: 'b' }], wall).get('e');
assert.ok(walled);
assert.deepEqual(routeProblems(walled, 'a', 'b', wall), []);

// Scattered boxes: every arrow follows the three rules.
let seed = 11;
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let round = 0; round < 40; round++) {
  const rects = new Map<string, Rect>();
  for (let i = 0; rects.size < 14 && i < 400; i++) {
    const candidate = box(Math.round(random() * 1200), Math.round(random() * 700));
    const clash = [...rects.values()].some(
      (r) => Math.abs(r.x - candidate.x) < 200 && Math.abs(r.y - candidate.y) < 90,
    );
    if (!clash) rects.set(`n${rects.size}`, candidate);
  }
  const ids = [...rects.keys()];
  const edges = ids.map((id, i) => ({ id: `e${i}`, source: id, target: ids[(i * 5 + 3) % ids.length] }));
  const routes = buildLiveRoutes(edges.filter((e) => e.source !== e.target), rects);
  for (const edge of edges) {
    const route = routes.get(edge.id);
    if (!route) continue;
    const problems = routeProblems(route, edge.source, edge.target, rects);
    if (problems.length) console.log(JSON.stringify({ route, s: rects.get(edge.source), t: rects.get(edge.target), others: [...rects.values()] }));
    assert.deepEqual(problems, [], `round ${round} ${edge.id}`);
  }
}

// The re-routed arrow avoids crossing an arrow that stays where it is.
const crossRects = new Map<string, Rect>([
  ['x', box(0, 100)],
  ['y', box(400, 100)],
  ['p', box(200, -200)],
  ['q', box(200, 300)],
]);
const fixed: Point[][] = [[{ x: 280, y: -152 }, { x: 280, y: 300 }]];
const rerouted = buildLiveRoutes([{ id: 'e', source: 'x', target: 'y' }], crossRects, fixed).get('e');
assert.ok(rerouted);
assert.deepEqual(routeProblems(rerouted, 'x', 'y', crossRects), []);
const crossesFixed = rerouted.some((point, i) => {
  const next = rerouted[i + 1];
  return next && Math.min(point.x, next.x) < 280 && Math.max(point.x, next.x) > 280 && Math.abs(point.y - next.y) < 1;
});
assert.equal(crossesFixed, true, 'the fixed arrow splits the plane: a crossing is unavoidable here');

// Same plane, but the fixed arrow is short: going around avoids the crossing.
const short: Point[][] = [[{ x: 280, y: -152 }, { x: 280, y: 60 }]];
const around = buildLiveRoutes([{ id: 'e', source: 'x', target: 'y' }], crossRects, short).get('e');
assert.ok(around);
assert.ok(
  !around.some((point, i) => {
    const next = around[i + 1];
    return next && Math.abs(point.y - next.y) < 1 && point.y < 60 && Math.min(point.x, next.x) < 280 && Math.max(point.x, next.x) > 280;
  }),
  'no crossing with the short fixed arrow',
);

console.log('arrowRouting.check: ok');

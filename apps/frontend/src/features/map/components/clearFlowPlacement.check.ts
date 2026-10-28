/**
 * Automatic application placement keeps flows orthogonal and clear.
 * Run: npx --yes tsx src/features/map/components/clearFlowPlacement.check.ts
 */
import assert from 'node:assert/strict';
import { placeClearFlows, type FlowPoint } from './clearFlowPlacement.ts';

const nodeSize = { width: 160, height: 48 };

const POINT_MATCH_DISTANCE = 0.5;
const MINIMUM_ROUTE_POINTS = 2;
const MAXIMUM_BENDS = 1;
const NO_BEND = 0;
const NO_CROSSING = 0;
const NO_HOP_POINTS = 0;

function buildNodes(ids: string[]) {
  return ids.map((id) => ({ id, ...nodeSize }));
}

function isOrthogonal(points: FlowPoint[]): boolean {
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const isHorizontal = Math.abs(previous.y - current.y) < POINT_MATCH_DISTANCE;
    const isVertical = Math.abs(previous.x - current.x) < POINT_MATCH_DISTANCE;
    if (!isHorizontal && !isVertical) return false;
  }
  return points.length >= MINIMUM_ROUTE_POINTS;
}

function countBends(points: FlowPoint[]): number {
  let bends = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const isSameX = Math.abs(previous.x - current.x) < POINT_MATCH_DISTANCE && Math.abs(current.x - next.x) < POINT_MATCH_DISTANCE;
    const isSameY = Math.abs(previous.y - current.y) < POINT_MATCH_DISTANCE && Math.abs(current.y - next.y) < POINT_MATCH_DISTANCE;
    if (!isSameX && !isSameY) bends += 1;
  }
  return bends;
}

function buildSegments(points: FlowPoint[]) {
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

function hasOverlappingRange(first: { start: number; end: number }, second: { start: number; end: number }): boolean {
  const overlapStart = Math.max(Math.min(first.start, first.end), Math.min(second.start, second.end));
  const overlapEnd = Math.min(Math.max(first.start, first.end), Math.max(second.start, second.end));
  return overlapEnd - overlapStart > POINT_MATCH_DISTANCE;
}

type Segment = ReturnType<typeof buildSegments>[number];

function hasSharedStretch(routes: Map<string, FlowPoint[]>): boolean {
  const all = [...routes.entries()].flatMap(([id, points]) =>
    buildSegments(points).map((segment) => ({ id, ...segment })),
  );
  return all.some((left, leftIndex) =>
    all.slice(leftIndex + 1).some((right) => left.id !== right.id && isSameStretch(left, right)),
  );
}

function isSameStretch(left: Segment, right: Segment): boolean {
  const isNear = (first: number, second: number) => Math.abs(first - second) < POINT_MATCH_DISTANCE;
  const isSameRowOverlap = isNear(left.y1, left.y2) && isNear(right.y1, right.y2) && isNear(left.y1, right.y1)
    && hasOverlappingRange({ start: left.x1, end: left.x2 }, { start: right.x1, end: right.x2 });
  const isSameColumnOverlap = isNear(left.x1, left.x2) && isNear(right.x1, right.x2) && isNear(left.x1, right.x1)
    && hasOverlappingRange({ start: left.y1, end: left.y2 }, { start: right.y1, end: right.y2 });
  return isSameRowOverlap || isSameColumnOverlap;
}

function countCrossings(routes: Map<string, FlowPoint[]>): number {
  const all = [...routes.entries()].flatMap(([id, points]) =>
    buildSegments(points).map((segment) => ({ id, ...segment })),
  );
  let count = 0;
  for (const horizontal of all) {
    if (Math.abs(horizontal.y1 - horizontal.y2) >= POINT_MATCH_DISTANCE) continue;
    for (const vertical of all) {
      if (horizontal.id === vertical.id) continue;
      if (Math.abs(vertical.x1 - vertical.x2) >= POINT_MATCH_DISTANCE) continue;
      const isInsideHorizontal = vertical.x1 > Math.min(horizontal.x1, horizontal.x2) + POINT_MATCH_DISTANCE
        && vertical.x1 < Math.max(horizontal.x1, horizontal.x2) - POINT_MATCH_DISTANCE;
      const isInsideVertical = horizontal.y1 > Math.min(vertical.y1, vertical.y2) + POINT_MATCH_DISTANCE
        && horizontal.y1 < Math.max(vertical.y1, vertical.y2) - POINT_MATCH_DISTANCE;
      if (isInsideHorizontal && isInsideVertical) count += 1;
    }
  }
  return count;
}

function assertClear(routes: Map<string, FlowPoint[]>, hops: Map<string, FlowPoint[]>) {
  for (const points of routes.values()) {
    assert.equal(isOrthogonal(points), true);
    assert.ok(countBends(points) <= MAXIMUM_BENDS);
  }
  assert.equal(hasSharedStretch(routes), false);
  assert.equal(countCrossings(routes), NO_CROSSING);
  assert.equal([...hops.values()].every((points) => points.length === NO_HOP_POINTS), true);
}

const chain = placeClearFlows(buildNodes(['a', 'b', 'c']), [
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
assert.equal(Math.abs(top.x - middle.x) < POINT_MATCH_DISTANCE, true);
assert.equal(countBends(chain.routes.get('ab') ?? []), NO_BEND);
assert.equal(countBends(chain.routes.get('bc') ?? []), NO_BEND);

const crossed = placeClearFlows(buildNodes(['a', 'b', 'c', 'd']), [
  { id: 'ad', source: 'a', target: 'd' },
  { id: 'bc', source: 'b', target: 'c' },
]);
assertClear(crossed.routes, crossed.hops);

const parallel = placeClearFlows(buildNodes(['a', 'b']), [
  { id: 'one', source: 'a', target: 'b' },
  { id: 'two', source: 'a', target: 'b' },
]);
assertClear(parallel.routes, parallel.hops);
const firstStart = parallel.routes.get('one')?.[0];
const secondStart = parallel.routes.get('two')?.[0];
assert.ok(firstStart && secondStart);
assert.equal(
  Math.abs(firstStart.x - secondStart.x) < POINT_MATCH_DISTANCE && Math.abs(firstStart.y - secondStart.y) < POINT_MATCH_DISTANCE,
  false,
);

const forced = placeClearFlows(
  buildNodes(['a', 'b', 'c', 'd', 'e', 'f']),
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
  assert.ok(countBends(points) <= MAXIMUM_BENDS);
}
assert.equal(hasSharedStretch(forced.routes), false);
assert.ok(countCrossings(forced.routes) > NO_CROSSING);
assert.ok([...forced.hops.values()].some((points) => points.length > NO_HOP_POINTS));

const bothWays = placeClearFlows(buildNodes(['a', 'b']), [
  { id: 'down', source: 'a', target: 'b' },
  { id: 'up', source: 'b', target: 'a' },
]);
assertClear(bothWays.routes, bothWays.hops);
const downStart = bothWays.routes.get('down')?.[0];
const upStart = bothWays.routes.get('up')?.[0];
assert.ok(downStart && upStart);
assert.equal(hasSamePoint(downStart, upStart), false);

const fan = placeClearFlows(buildNodes(['a', 'b', 'c', 'd']), [
  { id: 'ab', source: 'a', target: 'b' },
  { id: 'ac', source: 'a', target: 'c' },
  { id: 'ad', source: 'a', target: 'd' },
]);
assertClear(fan.routes, fan.hops);

const arrivals = placeClearFlows(buildNodes(['a', 'b', 'c']), [
  { id: 'ac', source: 'a', target: 'c' },
  { id: 'bc', source: 'b', target: 'c' },
]);
assertClear(arrivals.routes, arrivals.hops);
const arrivalEnds = ['ac', 'bc'].map((id) => {
  const route = arrivals.routes.get(id) ?? [];
  return route[route.length - 1];
});
assert.ok(arrivalEnds[0] && arrivalEnds[1]);
assert.equal(hasSamePoint(arrivalEnds[0], arrivalEnds[1]), false);

const rectangle = placeClearFlows(buildNodes(['a', 'b', 'c', 'd']), [
  { id: 'ab', source: 'a', target: 'b' },
  { id: 'cd', source: 'c', target: 'd' },
  { id: 'ad', source: 'a', target: 'd' },
  { id: 'cb', source: 'c', target: 'b' },
]);
assertClear(rectangle.routes, rectangle.hops);

const sideBySide = placeClearFlows(buildNodes(['a', 'b', 'c']), [
  { id: 'ab', source: 'a', target: 'b' },
  { id: 'ac', source: 'a', target: 'c' },
]);
assertClear(sideBySide.routes, sideBySide.hops);
for (const points of sideBySide.routes.values()) assert.equal(countBends(points), NO_BEND);
const isAnyRouteHorizontal = [...sideBySide.routes.values()].some(
  (points) => Math.abs(points[0].y - points[points.length - 1].y) < POINT_MATCH_DISTANCE,
);
assert.equal(isAnyRouteHorizontal, true);

const RANDOM_MULTIPLIER = 1103515245;
const RANDOM_INCREMENT = 12345;
const RANDOM_MODULUS = 2147483648;
const SEEDED_MAPS = [
  { seed: 7, applicationCount: 80, flowCount: 85 },
  { seed: 3, applicationCount: 80, flowCount: 80 },
  { seed: 8, applicationCount: 80, flowCount: 80 },
  { seed: 12, applicationCount: 80, flowCount: 80 },
  { seed: 5, applicationCount: 300, flowCount: 450 },
];
const COMPACT_MAP_APPLICATION_LIMIT = 80;
/** A landscape map pane. One card per row fits this pane only as hairlines. */
const MAP_PANE_WIDTH = 1200;
const MAP_PANE_HEIGHT = 700;
const MINIMUM_FIT_ZOOM = 0.2;

type SeededMap = { seed: number; applicationCount: number; flowCount: number };

function buildSeededIds(map: SeededMap): string[] {
  return Array.from({ length: map.applicationCount }, (_, index) => `n${index}`);
}

function buildSeededFlows(map: SeededMap) {
  let randomState = map.seed;
  const drawRandomIndex = (count: number) => {
    randomState = (randomState * RANDOM_MULTIPLIER + RANDOM_INCREMENT) % RANDOM_MODULUS;
    return Math.floor((randomState / RANDOM_MODULUS) * count);
  };
  return Array.from({ length: map.flowCount }, (_, index) => ({
    id: `e${index}`,
    source: `n${drawRandomIndex(map.applicationCount)}`,
    target: `n${drawRandomIndex(map.applicationCount)}`,
  })).filter((flow) => flow.source !== flow.target);
}

function placeSeededMap(map: SeededMap) {
  return placeClearFlows(buildNodes(buildSeededIds(map)), buildSeededFlows(map));
}

const FIT_ZOOM_DIGITS = 2;

function calculateMapFitZoom(positions: Map<string, FlowPoint>): number {
  const points = [...positions.values()];
  const width = Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x)) + nodeSize.width;
  const height = Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y)) + nodeSize.height;
  return Math.min(MAP_PANE_WIDTH / width, MAP_PANE_HEIGHT / height);
}

for (const map of SEEDED_MAPS) {
  const largeMap = placeSeededMap(map);
  for (const points of largeMap.routes.values()) {
    assert.equal(isOrthogonal(points), true);
    assert.ok(countBends(points) <= MAXIMUM_BENDS);
  }
  assert.equal(hasSharedStretch(largeMap.routes), false, `seed ${map.seed} shares a stretch`);
  if (map.applicationCount <= COMPACT_MAP_APPLICATION_LIMIT) {
    const fitZoom = calculateMapFitZoom(largeMap.positions);
    assert.ok(fitZoom >= MINIMUM_FIT_ZOOM, `seed ${map.seed} fits at ${fitZoom.toFixed(FIT_ZOOM_DIGITS)}`);
  }
}

const ISOLATED_APPLICATION_COUNT = 16;
const MAXIMUM_LINES_PER_APPLICATION = 0.5;
const isolatedIds = Array.from({ length: ISOLATED_APPLICATION_COUNT }, (_, index) => `alone${index}`);
const isolated = placeClearFlows(buildNodes(isolatedIds), []);
assert.equal(hasOverlappingCards(isolated.positions), false);
const isolatedCards = [...isolated.positions.values()];
const maximumLines = ISOLATED_APPLICATION_COUNT * MAXIMUM_LINES_PER_APPLICATION;
assert.ok(new Set(isolatedCards.map((card) => card.x)).size <= maximumLines, 'lone applications span too many columns');
assert.ok(new Set(isolatedCards.map((card) => card.y)).size <= maximumLines, 'lone applications span too many rows');

const islands = placeClearFlows(buildNodes(['a', 'b', 'c', 'd', 'e']), [
  { id: 'ab', source: 'a', target: 'b' },
  { id: 'cd', source: 'c', target: 'd' },
]);
assertClear(islands.routes, islands.hops);
assert.equal(hasOverlappingCards(islands.positions), false);

function hasOverlappingCards(positions: Map<string, FlowPoint>): boolean {
  const cards = [...positions.values()];
  return cards.some((left, leftIndex) => cards.slice(leftIndex + 1).some((right) => {
    const isOverlappingX = Math.abs(left.x - right.x) < nodeSize.width;
    const isOverlappingY = Math.abs(left.y - right.y) < nodeSize.height;
    return isOverlappingX && isOverlappingY;
  }));
}

function hasSamePoint(left: FlowPoint, right: FlowPoint): boolean {
  return Math.abs(left.x - right.x) < POINT_MATCH_DISTANCE && Math.abs(left.y - right.y) < POINT_MATCH_DISTANCE;
}

console.log('clearFlowPlacement.check: ok');

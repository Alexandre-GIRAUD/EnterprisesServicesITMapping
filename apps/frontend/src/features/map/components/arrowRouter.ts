import type { Point, Rect } from './elkLayout';

/** Free space kept between an arrow and every box it passes. */
const CLEARANCE = 4;
/** Distance an arrow keeps straight when it leaves or enters a box. */
const STUB = 18;
/** Boxes farther than this from the two ends are ignored on the first search. */
const WINDOW = 400;

const BEND_COST = 40;
const CROSSING_COST = 1000;
const OVERLAP_COST = 400;

type Dir = 0 | 1 | 2 | 3; // up, right, down, left
const STEP: Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

function sorted(values: Iterable<number>): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function hitsBox(a: Point, b: Point, rects: Rect[]): boolean {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  return rects.some(
    (r) =>
      maxX > r.x - CLEARANCE &&
      minX < r.x + r.width + CLEARANCE &&
      maxY > r.y - CLEARANCE &&
      minY < r.y + r.height + CLEARANCE,
  );
}

/** Crossings (transversal) and shared stretches between one segment and the other arrows. */
export function segmentConflicts(a: Point, b: Point, fixed: Point[][]): { crossings: number; overlaps: number } {
  let crossings = 0;
  let overlaps = 0;
  const horizontal = Math.abs(a.y - b.y) < 0.5;
  const lo = horizontal ? Math.min(a.x, b.x) : Math.min(a.y, b.y);
  const hi = horizontal ? Math.max(a.x, b.x) : Math.max(a.y, b.y);
  const line = horizontal ? a.y : a.x;
  for (const route of fixed) {
    for (let i = 0; i < route.length - 1; i++) {
      const p = route[i];
      const q = route[i + 1];
      const qHorizontal = Math.abs(p.y - q.y) < 0.5;
      const qLo = qHorizontal ? Math.min(p.x, q.x) : Math.min(p.y, q.y);
      const qHi = qHorizontal ? Math.max(p.x, q.x) : Math.max(p.y, q.y);
      const qLine = qHorizontal ? p.y : p.x;
      if (qHorizontal === horizontal) {
        if (Math.abs(qLine - line) < 1 && Math.min(hi, qHi) - Math.max(lo, qLo) > 1) overlaps++;
      } else if (qLine > lo + 0.5 && qLine < hi - 0.5 && line > qLo + 0.5 && line < qHi - 0.5) {
        crossings++;
      }
    }
  }
  return { crossings, overlaps };
}

/** Number of crossings plus shared stretches a whole route has with the other arrows. */
export function routeConflicts(route: Point[], fixed: Point[][]): number {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const { crossings, overlaps } = segmentConflicts(route[i], route[i + 1], fixed);
    total += crossings + overlaps;
  }
  return total;
}

class MinHeap {
  private items: { cost: number; state: number }[] = [];
  get size(): number {
    return this.items.length;
  }
  push(cost: number, state: number): void {
    const items = this.items;
    items.push({ cost, state });
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].cost <= items[i].cost) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }
  pop(): { cost: number; state: number } {
    const items = this.items;
    const top = items[0];
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < items.length && items[l].cost < items[m].cost) m = l;
        if (r < items.length && items[r].cost < items[m].cost) m = r;
        if (m === i) break;
        [items[m], items[i]] = [items[i], items[m]];
        i = m;
      }
    }
    return top;
  }
}

function search(
  from: Point,
  fromDir: Dir,
  to: Point,
  toDir: Dir,
  rects: Rect[],
  fixed: Point[][],
): Point[] | null {
  const xs = sorted([from.x, to.x, ...rects.flatMap((r) => [r.x - CLEARANCE - 2, r.x + r.width + CLEARANCE + 2])]);
  const ys = sorted([from.y, to.y, ...rects.flatMap((r) => [r.y - CLEARANCE - 2, r.y + r.height + CLEARANCE + 2])]);
  const midpoints = (values: number[]) =>
    values.slice(1).map((v, i) => (v + values[i]) / 2).filter((_, i) => values[i + 1] - values[i] >= 12);
  const gx = sorted([...xs, ...midpoints(xs)]);
  const gy = sorted([...ys, ...midpoints(ys)]);
  const nx = gx.length;
  const ny = gy.length;
  const index = (ix: number, iy: number, d: number) => (iy * nx + ix) * 4 + d;
  const startX = gx.indexOf(from.x);
  const startY = gy.indexOf(from.y);
  const goalX = gx.indexOf(to.x);
  const goalY = gy.indexOf(to.y);
  if (startX < 0 || startY < 0 || goalX < 0 || goalY < 0) return null;

  const best = new Float64Array(nx * ny * 4).fill(Infinity);
  const parent = new Int32Array(nx * ny * 4).fill(-1);
  const heap = new MinHeap();
  const startState = index(startX, startY, fromDir);
  best[startState] = 0;
  heap.push(0, startState);

  let finalCost = Infinity;
  let finalState = -1;
  while (heap.size > 0) {
    const { cost, state } = heap.pop();
    if (cost > best[state]) continue;
    const d = (state % 4) as Dir;
    const cell = (state - d) / 4;
    const ix = cell % nx;
    const iy = (cell - ix) / nx;
    if (cost >= finalCost) break;
    if (ix === goalX && iy === goalY && d !== (toDir + 2) % 4) {
      const total = cost + (d === toDir ? 0 : BEND_COST);
      if (total < finalCost) {
        finalCost = total;
        finalState = state;
      }
    }
    for (let nd = 0; nd < 4; nd++) {
      if (nd === (d + 2) % 4) continue;
      const jx = ix + STEP[nd].x;
      const jy = iy + STEP[nd].y;
      if (jx < 0 || jy < 0 || jx >= nx || jy >= ny) continue;
      const a = { x: gx[ix], y: gy[iy] };
      const b = { x: gx[jx], y: gy[jy] };
      if (hitsBox(a, b, rects)) continue;
      const { crossings, overlaps } = segmentConflicts(a, b, fixed);
      const next =
        cost +
        Math.abs(b.x - a.x) +
        Math.abs(b.y - a.y) +
        (nd === d ? 0 : BEND_COST) +
        crossings * CROSSING_COST +
        overlaps * OVERLAP_COST;
      const nextState = index(jx, jy, nd);
      if (next < best[nextState]) {
        best[nextState] = next;
        parent[nextState] = state;
        heap.push(next, nextState);
      }
    }
  }
  if (finalState < 0) return null;
  const path: Point[] = [];
  for (let s = finalState; s !== -1; s = parent[s]) {
    const c = (s - (s % 4)) / 4;
    path.push({ x: gx[c % nx], y: gy[(c - (c % nx)) / nx] });
  }
  return path.reverse();
}

function directionOf(from: Point, to: Point): Dir {
  if (Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)) return to.x >= from.x ? 1 : 3;
  return to.y >= from.y ? 2 : 0;
}

/**
 * Orthogonal route from `start` (on a box border, leaving along `outward`) to `end` (on a box
 * border, entered against `inward`) that never touches a box and crosses as few of the `fixed`
 * arrows as it can. Returns null when no such route exists.
 */
export function routeAroundBoxes(
  start: Point,
  startOutward: Point,
  end: Point,
  endOutward: Point,
  rects: Map<string, Rect>,
  fixed: Point[][],
): Point[] | null {
  const away = (p: Point, out: Point): Point => ({ x: p.x + out.x * STUB, y: p.y + out.y * STUB });
  const from = away(start, startOutward);
  const to = away(end, endOutward);
  const fromDir = directionOf(start, from);
  const toDir = directionOf(to, end);
  const lo = { x: Math.min(from.x, to.x) - WINDOW, y: Math.min(from.y, to.y) - WINDOW };
  const hi = { x: Math.max(from.x, to.x) + WINDOW, y: Math.max(from.y, to.y) + WINDOW };
  const all = [...rects.values()];
  const near = all.filter((r) => r.x < hi.x && r.x + r.width > lo.x && r.y < hi.y && r.y + r.height > lo.y);
  const clear = (path: Point[]) => path.every((p, i) => i === 0 || !hitsBox(path[i - 1], p, all));
  let path = search(from, fromDir, to, toDir, near, fixed);
  if (near.length < all.length && (!path || !clear(path))) path = search(from, fromDir, to, toDir, all, fixed);
  return path && [start, ...path, end];
}

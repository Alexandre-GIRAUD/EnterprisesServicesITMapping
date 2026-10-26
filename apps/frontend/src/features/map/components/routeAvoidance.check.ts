/**
 * Edge routes must go around a box instead of through it.
 * Run: npx --yes tsx src/features/map/components/routeAvoidance.check.ts
 */
import assert from 'node:assert/strict';
import type { Rect } from './elkLayout.ts';
import { buildLiveRoutes } from './elkLayout.ts';

function box(x: number, y: number, width = 160, height = 48): Rect {
  return { x, y, width, height };
}

function segmentHits(a: { x: number; y: number }, b: { x: number; y: number }, rect: Rect): boolean {
  const x0 = rect.x;
  const y0 = rect.y;
  const x1 = rect.x + rect.width;
  const y1 = rect.y + rect.height;
  if (Math.abs(a.y - b.y) < 0.5) {
    if (a.y <= y0 || a.y >= y1) return false;
    return Math.max(a.x, b.x) > x0 && Math.min(a.x, b.x) < x1;
  }
  if (Math.abs(a.x - b.x) < 0.5) {
    if (a.x <= x0 || a.x >= x1) return false;
    return Math.max(a.y, b.y) > y0 && Math.min(a.y, b.y) < y1;
  }
  return false;
}

function crosses(points: { x: number; y: number }[], rects: Map<string, Rect>, skip: string[]): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    for (const [id, rect] of rects) {
      if (skip.includes(id)) continue;
      if (segmentHits(points[i], points[i + 1], rect)) return true;
    }
  }
  return false;
}

const blocked = new Map<string, Rect>([
  ['a', box(200, 0)],
  ['b', box(200, 110)],
  ['c', box(200, 250)],
  ['d', box(20, 90, 170, 80)],
  ['e', box(350, 90, 180, 80)],
]);

const around = buildLiveRoutes([{ id: 'ac', source: 'a', target: 'c' }], blocked).get('ac');
assert.ok(around && around.length >= 2);
assert.equal(crosses(around, blocked, ['a', 'c']), false);

const open = new Map<string, Rect>([
  ['a', box(0, 0)],
  ['c', box(0, 200)],
]);
const straight = buildLiveRoutes([{ id: 'ac', source: 'a', target: 'c' }], open).get('ac');
assert.ok(straight);
assert.equal(straight.length, 2);
assert.equal(straight[0].x, straight[1].x);

console.log('routeAvoidance.check: ok');

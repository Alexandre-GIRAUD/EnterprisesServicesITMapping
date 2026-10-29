import type { Point } from './elkLayout';

type Segment = {
  edgeId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

const EPS = 0.5;

function isHorizontal(s: Segment): boolean {
  return Math.abs(s.y1 - s.y2) < EPS && Math.abs(s.x1 - s.x2) >= EPS;
}

function isVertical(s: Segment): boolean {
  return Math.abs(s.x1 - s.x2) < EPS && Math.abs(s.y1 - s.y2) >= EPS;
}

/**
 * Compute line-jump ("bridge") markers for a set of orthogonal routes.
 *
 * Math: for an orthogonal layout every segment is axis-aligned, so two unrelated
 * edges can only cross where a horizontal segment of one meets a vertical
 * segment of another. A horizontal segment `h` (constant y) and a vertical
 * segment `v` (constant x) intersect at `(v.x, h.y)` iff that point lies
 * strictly inside both spans. By convention the horizontal edge "hops" the
 * vertical one, so the crossing is recorded against the horizontal segment's
 * edge. Complexity O(H · V) over segments.
 */
export function computeBridges(routes: Map<string, Point[]>): Map<string, Point[]> {
  const horizontals: Segment[] = [];
  const verticals: Segment[] = [];

  for (const [edgeId, points] of routes) {
    for (let i = 0; i < points.length - 1; i++) {
      const seg: Segment = {
        edgeId,
        x1: points[i].x,
        y1: points[i].y,
        x2: points[i + 1].x,
        y2: points[i + 1].y,
      };
      if (isHorizontal(seg)) horizontals.push(seg);
      else if (isVertical(seg)) verticals.push(seg);
    }
  }

  const jumpsByEdge = new Map<string, Point[]>();
  const addJump = (edgeId: string, point: Point) => {
    const list = jumpsByEdge.get(edgeId) ?? jumpsByEdge.set(edgeId, []).get(edgeId)!;
    if (!list.some((p) => Math.abs(p.x - point.x) < EPS && Math.abs(p.y - point.y) < EPS)) {
      list.push(point);
    }
  };

  for (const h of horizontals) {
    const hMinX = Math.min(h.x1, h.x2);
    const hMaxX = Math.max(h.x1, h.x2);
    const y = h.y1;
    for (const v of verticals) {
      if (v.edgeId === h.edgeId) continue;
      const x = v.x1;
      const vMinY = Math.min(v.y1, v.y2);
      const vMaxY = Math.max(v.y1, v.y2);
      const insideH = x > hMinX + EPS && x < hMaxX - EPS;
      const insideV = y > vMinY + EPS && y < vMaxY - EPS;
      if (insideH && insideV) {
        addJump(h.edgeId, { x, y });
      }
    }
  }

  return jumpsByEdge;
}

/** Parallel arrows sit this far apart so their strokes do not cover each other. */
export const LANE_GAP = 12;

const AXIS_EPS = 1;
const MIN_STACK = 8;

type StackItem = {
  edgeId: string;
  index: number;
  fixed: number;
  start: number;
  end: number;
  jog: boolean;
};

function laneOffset(index: number): number {
  if (index === 0) return 0;
  const step = Math.ceil(index / 2);
  const sign = index % 2 === 1 ? 1 : -1;
  return sign * step * LANE_GAP;
}

function copyRoutes(routes: Map<string, Point[]>): Map<string, Point[]> {
  const copy = new Map<string, Point[]>();
  for (const [edgeId, points] of routes) {
    copy.set(edgeId, points.map((point) => ({ x: point.x, y: point.y })));
  }
  return copy;
}

function axisSegments(routes: Map<string, Point[]>, vertical: boolean): StackItem[] {
  const items: StackItem[] = [];
  for (const [edgeId, points] of routes) {
    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      if (!start || !end) continue;
      const alongX = Math.abs(start.x - end.x);
      const alongY = Math.abs(start.y - end.y);
      const isVertical = alongX < AXIS_EPS && alongY >= MIN_STACK;
      const isHorizontal = alongY < AXIS_EPS && alongX >= MIN_STACK;
      if (vertical ? !isVertical : !isHorizontal) continue;
      items.push({
        edgeId,
        index,
        fixed: vertical ? start.x : start.y,
        start: vertical ? Math.min(start.y, end.y) : Math.min(start.x, end.x),
        end: vertical ? Math.max(start.y, end.y) : Math.max(start.x, end.x),
        jog: index === 0 || index + 1 === points.length - 1,
      });
    }
  }
  return items;
}

function groupByFixed(items: StackItem[]): StackItem[][] {
  const sorted = [...items].sort((left, right) => left.fixed - right.fixed);
  const groups: StackItem[][] = [];
  for (const item of sorted) {
    const current = groups[groups.length - 1];
    const anchor = current?.[0];
    if (current && anchor && Math.abs(item.fixed - anchor.fixed) <= AXIS_EPS) current.push(item);
    else groups.push([item]);
  }
  return groups;
}

function overlapGroups(items: StackItem[]): StackItem[][] {
  const sorted = [...items].sort(
    (left, right) => left.start - right.start || left.edgeId.localeCompare(right.edgeId),
  );
  const groups: StackItem[][] = [];
  let group: StackItem[] = [];
  let end = -Infinity;
  for (const item of sorted) {
    if (group.length > 0 && item.start > end - MIN_STACK) {
      if (group.length > 1) groups.push(group);
      group = [item];
      end = item.end;
      continue;
    }
    group.push(item);
    end = Math.max(end, item.end);
  }
  if (group.length > 1) groups.push(group);
  return groups;
}

function shiftSegment(
  routes: Map<string, Point[]>,
  item: StackItem,
  delta: number,
  vertical: boolean,
): void {
  if (delta === 0) return;
  const points = routes.get(item.edgeId);
  const start = points?.[item.index];
  const end = points?.[item.index + 1];
  if (!start || !end) return;
  if (vertical) {
    start.x += delta;
    end.x += delta;
    return;
  }
  start.y += delta;
  end.y += delta;
}

function jogSegment(points: Point[], index: number, delta: number, vertical: boolean): void {
  const start = points[index];
  const end = points[index + 1];
  if (!start || !end) return;
  if (vertical) {
    points.splice(
      index + 1,
      0,
      { x: start.x + delta, y: start.y },
      { x: start.x + delta, y: end.y },
    );
    return;
  }
  points.splice(
    index + 1,
    0,
    { x: start.x, y: start.y + delta },
    { x: end.x, y: start.y + delta },
  );
}

function separateAxis(routes: Map<string, Point[]>, vertical: boolean): void {
  const pending: { item: StackItem; delta: number }[] = [];
  for (const fixedGroup of groupByFixed(axisSegments(routes, vertical))) {
    for (const overlap of overlapGroups(fixedGroup)) {
      const ordered = [...overlap].sort((left, right) => left.edgeId.localeCompare(right.edgeId));
      ordered.forEach((item, index) => {
        const delta = laneOffset(index);
        if (delta !== 0) pending.push({ item, delta });
      });
    }
  }
  const byEdge = new Map<string, { item: StackItem; delta: number }[]>();
  for (const entry of pending) {
    const list = byEdge.get(entry.item.edgeId) ?? [];
    list.push(entry);
    byEdge.set(entry.item.edgeId, list);
  }
  for (const [edgeId, list] of byEdge) {
    const points = routes.get(edgeId);
    if (!points) continue;
    list.sort((left, right) => right.item.index - left.item.index);
    for (const entry of list) {
      if (entry.item.jog) jogSegment(points, entry.item.index, entry.delta, vertical);
      else shiftSegment(routes, entry.item, entry.delta, vertical);
    }
  }
}

/**
 * Pull collinear overlapping runs onto parallel lanes.
 * Anchors stay put. Crossings are left for {@link computeBridges}.
 * ponytail: one pass per axis; a later overlap created by a lane shift is not re-scanned.
 */
export function spreadStackedRoutes(routes: Map<string, Point[]>): Map<string, Point[]> {
  const copy = copyRoutes(routes);
  separateAxis(copy, true);
  separateAxis(copy, false);
  return copy;
}

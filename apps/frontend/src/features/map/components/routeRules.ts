import type { Point, Rect } from './elkLayout';

/** How far an arrow end may sit from its box outline and still count as touching it. */
const TOUCH_TOLERANCE = 1;

type Side = 'top' | 'right' | 'bottom' | 'left';

const INWARD: Record<Side, Point> = {
  top: { x: 0, y: 1 },
  bottom: { x: 0, y: -1 },
  left: { x: 1, y: 0 },
  right: { x: -1, y: 0 },
};

/** Sides of `rect` whose border line `p` lies on. Empty when `p` is not on the outline. */
function touchedSides(p: Point, rect: Rect): Side[] {
  const withinX = p.x >= rect.x - TOUCH_TOLERANCE && p.x <= rect.x + rect.width + TOUCH_TOLERANCE;
  const withinY = p.y >= rect.y - TOUCH_TOLERANCE && p.y <= rect.y + rect.height + TOUCH_TOLERANCE;
  const sides: Side[] = [];
  if (withinX && Math.abs(p.y - rect.y) <= TOUCH_TOLERANCE) sides.push('top');
  if (withinX && Math.abs(p.y - (rect.y + rect.height)) <= TOUCH_TOLERANCE) sides.push('bottom');
  if (withinY && Math.abs(p.x - rect.x) <= TOUCH_TOLERANCE) sides.push('left');
  if (withinY && Math.abs(p.x - (rect.x + rect.width)) <= TOUCH_TOLERANCE) sides.push('right');
  return sides;
}

/** True when the axis-aligned segment a-b enters the open interior of `rect`. */
function segmentCrossesBox(a: Point, b: Point, rect: Rect): boolean {
  return (
    Math.max(a.x, b.x) > rect.x + TOUCH_TOLERANCE &&
    Math.min(a.x, b.x) < rect.x + rect.width - TOUCH_TOLERANCE &&
    Math.max(a.y, b.y) > rect.y + TOUCH_TOLERANCE &&
    Math.min(a.y, b.y) < rect.y + rect.height - TOUCH_TOLERANCE
  );
}

/** The end `tip` of a segment coming from `from` touches `rect` and moves toward it, not along or away from it. */
function pointsIntoBox(from: Point, tip: Point, rect: Rect): boolean {
  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  return touchedSides(tip, rect).some((side) => {
    const inward = INWARD[side];
    return dx * inward.x + dy * inward.y > TOUCH_TOLERANCE;
  });
}

type RouteProblem = 'start-off-outline' | 'end-off-outline' | 'crosses-box' | 'head-away-from-target' | 'tail-into-source';

/**
 * Rules every arrow follows: both ends touch the outline of their boxes, the line
 * never passes over a box, and the arrowhead points into the destination box.
 */
export function routeProblems(
  route: Point[],
  sourceId: string,
  targetId: string,
  rects: Map<string, Rect>,
): RouteProblem[] {
  const source = rects.get(sourceId);
  const target = rects.get(targetId);
  if (route.length < 2 || !source || !target) return [];
  const problems: RouteProblem[] = [];
  const first = route[0];
  const last = route[route.length - 1];
  if (touchedSides(first, source).length === 0) problems.push('start-off-outline');
  if (touchedSides(last, target).length === 0) problems.push('end-off-outline');
  if (!pointsIntoBox(route[1], first, source) && touchedSides(first, source).length > 0) {
    problems.push('tail-into-source');
  }
  if (!pointsIntoBox(route[route.length - 2], last, target) && touchedSides(last, target).length > 0) {
    problems.push('head-away-from-target');
  }
  for (let i = 0; i < route.length - 1; i++) {
    for (const rect of rects.values()) {
      if (segmentCrossesBox(route[i], route[i + 1], rect)) {
        problems.push('crosses-box');
        return problems;
      }
    }
  }
  return problems;
}

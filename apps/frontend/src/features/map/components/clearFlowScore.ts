import type { FlowPlacementEdge, FlowPoint } from './clearFlowPlacement';

const POINT_MATCH_DISTANCE = 0.5;

/** Lower is better, compared key by key in `SCORE_PRIORITY` order. */
export type PlacementScore = {
  sharedStretches: number;
  cuts: number;
  crossings: number;
  bends: number;
};

/**
 * A stacked stretch hides a flow, and a flow drawn across an unrelated card hides
 * that card, so both rank above a crossing, which still reads as a hop.
 */
const SCORE_PRIORITY = ['sharedStretches', 'cuts', 'crossings', 'bends'] as const;

type CardRect = { id: string; x: number; y: number; width: number; height: number };

type RouteSegment = { id: string; x1: number; y1: number; x2: number; y2: number };

type Span = { low: number; high: number };

export function scoreRoutes(placement: {
  routes: Map<string, FlowPoint[]>;
  rects: Map<string, CardRect>;
  edges: readonly FlowPlacementEdge[];
}): PlacementScore {
  const segments = listSegments(placement.routes);
  return {
    sharedStretches: countSharedStretches(segments),
    cuts: countCardCuts(segments, placement),
    crossings: countCrossings(segments),
    bends: countBends(placement.routes),
  };
}

export function isScoreBetter(next: PlacementScore, current: PlacementScore): boolean {
  for (const key of SCORE_PRIORITY) {
    if (next[key] !== current[key]) return next[key] < current[key];
  }
  return false;
}

export function isScorePerfect(score: PlacementScore): boolean {
  return SCORE_PRIORITY.every((key) => score[key] === 0);
}

function listSegments(routes: Map<string, FlowPoint[]>): RouteSegment[] {
  const segments: RouteSegment[] = [];
  for (const [id, points] of routes) {
    for (let index = 1; index < points.length; index += 1) {
      const start = points[index - 1];
      const end = points[index];
      if (start && end) segments.push({ id, x1: start.x, y1: start.y, x2: end.x, y2: end.y });
    }
  }
  return segments;
}

function countSharedStretches(segments: readonly RouteSegment[]): number {
  let sharedStretches = 0;
  segments.forEach((left, leftIndex) => {
    for (const right of segments.slice(leftIndex + 1)) {
      if (left.id !== right.id && isStretchShared(left, right)) sharedStretches += 1;
    }
  });
  return sharedStretches;
}

function isStretchShared(left: RouteSegment, right: RouteSegment): boolean {
  const isHorizontalPair = isHorizontal(left) && isHorizontal(right) && isNear(left.y1, right.y1);
  if (isHorizontalPair) return isSpanOverlapping(toSpan(left.x1, left.x2), toSpan(right.x1, right.x2));
  const isVerticalPair = isVertical(left) && isVertical(right) && isNear(left.x1, right.x1);
  if (isVerticalPair) return isSpanOverlapping(toSpan(left.y1, left.y2), toSpan(right.y1, right.y2));
  return false;
}

function countCardCuts(
  segments: readonly RouteSegment[],
  placement: { rects: Map<string, CardRect>; edges: readonly FlowPlacementEdge[] },
): number {
  const edgeById = new Map(placement.edges.map((edge) => [edge.id, edge]));
  let cuts = 0;
  for (const segment of segments) {
    const edge = edgeById.get(segment.id);
    for (const rect of placement.rects.values()) {
      const isOwnCard = rect.id === edge?.source || rect.id === edge?.target;
      if (!isOwnCard && isCuttingCard(segment, rect)) cuts += 1;
    }
  }
  return cuts;
}

function isCuttingCard(segment: RouteSegment, rect: CardRect): boolean {
  const cardWidth = toSpan(rect.x, rect.x + rect.width);
  const cardHeight = toSpan(rect.y, rect.y + rect.height);
  if (isHorizontal(segment)) {
    return isStrictlyInside(segment.y1, cardHeight) && isSpanOverlapping(toSpan(segment.x1, segment.x2), cardWidth);
  }
  return isStrictlyInside(segment.x1, cardWidth) && isSpanOverlapping(toSpan(segment.y1, segment.y2), cardHeight);
}

function countCrossings(segments: readonly RouteSegment[]): number {
  let crossings = 0;
  for (const horizontal of segments.filter(isHorizontal)) {
    for (const vertical of segments.filter(isVertical)) {
      if (horizontal.id !== vertical.id && isCrossing(horizontal, vertical)) crossings += 1;
    }
  }
  return crossings;
}

function isCrossing(horizontal: RouteSegment, vertical: RouteSegment): boolean {
  return isStrictlyInside(vertical.x1, toSpan(horizontal.x1, horizontal.x2))
    && isStrictlyInside(horizontal.y1, toSpan(vertical.y1, vertical.y2));
}

function countBends(routes: Map<string, FlowPoint[]>): number {
  let bends = 0;
  for (const points of routes.values()) {
    for (let index = 1; index < points.length - 1; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      const next = points[index + 1];
      if (previous && current && next && isCorner(previous, current, next)) bends += 1;
    }
  }
  return bends;
}

function isCorner(previous: FlowPoint, current: FlowPoint, next: FlowPoint): boolean {
  const isSameX = isNear(previous.x, current.x) && isNear(current.x, next.x);
  const isSameY = isNear(previous.y, current.y) && isNear(current.y, next.y);
  return !isSameX && !isSameY;
}

function isHorizontal(segment: RouteSegment): boolean {
  return isNear(segment.y1, segment.y2);
}

function isVertical(segment: RouteSegment): boolean {
  return isNear(segment.x1, segment.x2);
}

function isNear(left: number, right: number): boolean {
  return Math.abs(left - right) < POINT_MATCH_DISTANCE;
}

function isStrictlyInside(value: number, span: Span): boolean {
  return value > span.low + POINT_MATCH_DISTANCE && value < span.high - POINT_MATCH_DISTANCE;
}

function toSpan(start: number, end: number): Span {
  return { low: Math.min(start, end), high: Math.max(start, end) };
}

function isSpanOverlapping(left: Span, right: Span): boolean {
  return Math.min(left.high, right.high) - Math.max(left.low, right.low) > POINT_MATCH_DISTANCE;
}

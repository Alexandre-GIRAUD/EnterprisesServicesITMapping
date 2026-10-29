import type { Point, Rect } from './elkLayout';

/** A flow label to place on the route of one edge. Sizes are in flow-coordinate pixels. */
export type LabelRequest = {
  id: string;
  points: Point[];
  width: number;
  height: number;
  sourceId: string;
  targetId: string;
};

export type LabelObstacle = Rect & { id: string };

/** Step (px) between candidate positions sampled along the route. */
const ARC_SAMPLE_STEP = 10;
/** Step (px) between candidate positions pushed sideways off the route. */
const SIDE_STEP = 12;
const MAX_SIDE_STEPS = 40;

const LABEL_CHAR_WIDTH = 6.8;
const LABEL_HORIZONTAL_CHROME = 18;
const LABEL_HEIGHT = 22;

/** Estimated pill size for a label text (the real size is only known once rendered). */
export function estimateLabelSize(text: string): { width: number; height: number } {
  return { width: text.length * LABEL_CHAR_WIDTH + LABEL_HORIZONTAL_CHROME, height: LABEL_HEIGHT };
}

/** Point lying `targetDist` px along the polyline, clamped to its last point. */
function pointAtArcDistance(points: Point[], targetDist: number): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  let accumulated = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (accumulated + segLen >= targetDist) {
      const t = segLen > 0 ? (targetDist - accumulated) / segLen : 0;
      return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
    }
    accumulated += segLen;
  }
  return { x: points[points.length - 1].x, y: points[points.length - 1].y };
}

function polylineLength(points: Point[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  }
  return total;
}

/** Point at 50% of the total arc length of the polyline. */
export function arcMidpoint(points: Point[]): Point {
  return pointAtArcDistance(points, polylineLength(points) / 2);
}

function boxAround(center: Point, label: LabelRequest): Rect {
  return {
    x: center.x - label.width / 2,
    y: center.y - label.height / 2,
    width: label.width,
    height: label.height,
  };
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Candidates closest to the route midpoint first: along the route, then sideways off it. */
function candidatePositions(points: Point[]): Point[] {
  const total = polylineLength(points);
  const mid = arcMidpoint(points);
  const candidates: Point[] = [mid];
  for (let d = ARC_SAMPLE_STEP; d <= total / 2; d += ARC_SAMPLE_STEP) {
    candidates.push(pointAtArcDistance(points, total / 2 + d), pointAtArcDistance(points, total / 2 - d));
  }
  const first = points[0] ?? mid;
  const last = points[points.length - 1] ?? mid;
  const chord = Math.hypot(last.x - first.x, last.y - first.y);
  const perp = chord > 0 ? { x: -(last.y - first.y) / chord, y: (last.x - first.x) / chord } : { x: 0, y: 1 };
  for (let k = 1; k <= MAX_SIDE_STEPS; k++) {
    const offset = k * SIDE_STEP;
    candidates.push(
      { x: mid.x + perp.x * offset, y: mid.y + perp.y * offset },
      { x: mid.x - perp.x * offset, y: mid.y - perp.y * offset },
    );
  }
  return candidates;
}

/**
 * One position per label such that no label overlaps another label, nor a node other
 * than its own source or target. Labels are placed in id order so the result does not
 * depend on the order the edges are given in. When no clear spot exists, the candidate
 * crossing the fewest boxes wins.
 */
export function placeEdgeLabels(
  labels: LabelRequest[],
  obstacles: LabelObstacle[],
): Map<string, Point> {
  const placed = new Map<string, Point>();
  const placedBoxes: Rect[] = [];
  const ordered = [...labels].sort((a, b) => a.id.localeCompare(b.id));

  for (const label of ordered) {
    const blockers: Rect[] = [
      ...obstacles.filter((o) => o.id !== label.sourceId && o.id !== label.targetId),
      ...placedBoxes,
    ];
    let best: { position: Point; hits: number } | null = null;
    for (const position of candidatePositions(label.points)) {
      const box = boxAround(position, label);
      const hits = blockers.filter((blocker) => overlaps(box, blocker)).length;
      if (hits === 0) {
        best = { position, hits };
        break;
      }
      if (!best || hits < best.hits) best = { position, hits };
    }
    const position = best?.position ?? arcMidpoint(label.points);
    placed.set(label.id, position);
    placedBoxes.push(boxAround(position, label));
  }
  return placed;
}

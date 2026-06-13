import type { Point } from './elkLayout';

type UnitVector = { x: number; y: number; len: number };

function unit(a: Point, b: Point): UnitVector {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len, len };
}

const EPS = 0.5;

/**
 * Emit a straight horizontal/vertical run from `s` to `e`. On horizontal runs,
 * any line-jump whose y matches the run and whose x falls inside it is rendered
 * as a small semicircular "hop" (the line arcs over the crossing) so unrelated
 * edges read as not connected.
 */
function runWithJumps(s: Point, e: Point, jumps: Point[], hopRadius: number): string {
  const horizontal = Math.abs(s.y - e.y) < EPS && Math.abs(s.x - e.x) >= EPS;
  if (!horizontal) {
    return ` L ${e.x} ${e.y}`;
  }

  const y = s.y;
  const sx = Math.sign(e.x - s.x);
  const relevant = jumps
    .filter(
      (j) =>
        Math.abs(j.y - y) < EPS &&
        (j.x - s.x) * sx > hopRadius &&
        (e.x - j.x) * sx > hopRadius
    )
    .sort((a, b) => (a.x - b.x) * sx);

  let d = '';
  for (const j of relevant) {
    const x0 = j.x - hopRadius * sx;
    const x1 = j.x + hopRadius * sx;
    // Semicircle bulging toward -y (upward) regardless of travel direction.
    const sweep = sx > 0 ? 0 : 1;
    d += ` L ${x0} ${y} A ${hopRadius} ${hopRadius} 0 0 ${sweep} ${x1} ${y}`;
  }
  d += ` L ${e.x} ${e.y}`;
  return d;
}

/**
 * Build an SVG path string for an orthogonal poly-line with rounded bends and
 * optional line-jump bridges.
 *
 * Corner rounding: at each interior vertex `V` between incoming/outgoing
 * segments, the corner is trimmed by `radius` (capped at half of each adjacent
 * segment so it never overshoots) to `entry = V - radius·inDir` and
 * `exit = V + radius·outDir`, joined by a quadratic Bézier whose control point
 * is `V`. Straight runs between trimmed corners carry the hop arcs.
 */
export function buildOrthogonalPath(
  points: Point[],
  radius = 8,
  jumps: Point[] = [],
  hopRadius = 5
): string {
  if (points.length < 2) return '';
  const n = points.length;

  const entries: Point[] = [];
  const exits: Point[] = [];
  for (let i = 1; i < n - 1; i++) {
    const inDir = unit(points[i - 1], points[i]);
    const outDir = unit(points[i], points[i + 1]);
    const r = Math.min(radius, inDir.len / 2, outDir.len / 2);
    entries[i] = { x: points[i].x - inDir.x * r, y: points[i].y - inDir.y * r };
    exits[i] = { x: points[i].x + outDir.x * r, y: points[i].y + outDir.y * r };
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  let cursor = points[0];
  for (let i = 1; i < n; i++) {
    const runEnd = i < n - 1 ? entries[i] : points[n - 1];
    d += runWithJumps(cursor, runEnd, jumps, hopRadius);
    if (i < n - 1) {
      d += ` Q ${points[i].x} ${points[i].y} ${exits[i].x} ${exits[i].y}`;
      cursor = exits[i];
    }
  }
  return d;
}

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

import type { Edge } from '@xyflow/react';
import type { Rect } from './elkLayout';
import type { OrientedEdgeData } from './OrientedEdge';

/** How far a stored route end may sit from its box border before the arrow is redrawn. */
export const BORDER_TOLERANCE = 14;

export function pointRectDistance(p: { x: number; y: number }, r: Rect): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.width));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.height));
  return Math.hypot(dx, dy);
}

/** Ids of the arrows whose stored route no longer touches their boxes, i.e. attached to a moved or resized box. */
export function findStaleEdgeIds(
  edges: Pick<Edge, 'id' | 'source' | 'target' | 'data'>[],
  rectById: Map<string, Rect>
): Set<string> {
  const stale = new Set<string>();
  for (const edge of edges) {
    const data = edge.data as OrientedEdgeData | undefined;
    if (!data?.routeStart || !data?.routeEnd) continue;
    const srcRect = rectById.get(edge.source);
    const tgtRect = rectById.get(edge.target);
    if (!srcRect || !tgtRect) continue;
    if (
      pointRectDistance(data.routeStart, srcRect) > BORDER_TOLERANCE ||
      pointRectDistance(data.routeEnd, tgtRect) > BORDER_TOLERANCE
    ) {
      stale.add(edge.id);
    }
  }
  return stale;
}

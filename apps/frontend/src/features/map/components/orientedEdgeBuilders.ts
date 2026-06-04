import { MarkerType } from '@xyflow/react';
import { EDGE_TYPE_STYLES, nodeColorForType } from './graphTheme';
import type { OrientedEdgeType } from './OrientedEdge';
import type { Point } from './elkLayout';

/** Arrowhead marker tinted to match the target-node color. */
export function orientedMarkerEnd(targetColor: string) {
  return { type: MarkerType.ArrowClosed, color: targetColor, width: 16, height: 16 };
}

/** Build an {@link OrientedEdgeType} with colors derived from the node types it connects. */
export function buildOrientedEdge(params: {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: string;
  sourceNodeType: string;
  targetNodeType: string;
}): OrientedEdgeType {
  const sourceColor = nodeColorForType(params.sourceNodeType);
  const targetColor = nodeColorForType(params.targetNodeType);
  const dashed = Boolean(
    (EDGE_TYPE_STYLES as Record<string, { dashed?: boolean } | undefined>)[params.relationType]
      ?.dashed
  );
  return {
    id: params.id,
    source: params.sourceId,
    target: params.targetId,
    type: 'oriented',
    label: params.relationType,
    markerEnd: orientedMarkerEnd(targetColor),
    data: { sourceColor, targetColor, dashed, relation: params.relationType },
  };
}

/**
 * Merge an ELK orthogonal route (and its line-jumps) into an edge's data so the
 * {@link OrientedEdge} renderer draws node-avoiding bends instead of the
 * smoothstep fallback. Interior bend points exclude the route endpoints (the
 * edge uses live handle positions for those).
 */
export function attachRoute(
  edge: OrientedEdgeType,
  route: Point[] | undefined,
  jumps: Point[] | undefined
): OrientedEdgeType {
  if (!route || route.length < 2) return edge;
  return {
    ...edge,
    data: {
      ...edge.data!,
      bendPoints: route.slice(1, -1),
      routeStart: route[0],
      routeEnd: route[route.length - 1],
      jumps: jumps ?? [],
    },
  };
}

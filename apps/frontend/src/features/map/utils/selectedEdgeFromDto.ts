import type { GraphEdgeDto } from '@/types/api';

export type SelectedEdgeDetails = {
  id: string;
  sourceId: string;
  targetId: string;
  sourceLabel: string;
  targetLabel: string;
  type: string;
  data?: string | null;
  properties?: Record<string, string>;
  /** True for sandbox-local edges (read-only, no backend fetch). */
  sandbox?: boolean;
};

type FlowEdgeLike = {
  id: string;
  source: string;
  target: string;
  data?: {
    indirect?: boolean;
    relation?: string;
    dataKey?: string | null;
    properties?: Record<string, string>;
  };
};

/** Build drawer payload from a GraphEdgeDto + id→label map. */
export function selectedEdgeFromDto(
  dto: GraphEdgeDto,
  labelById: Map<string, string>,
  sandbox = false
): SelectedEdgeDetails {
  return {
    id: dto.id,
    sourceId: dto.sourceId,
    targetId: dto.targetId,
    sourceLabel: labelById.get(dto.sourceId) ?? dto.sourceId,
    targetLabel: labelById.get(dto.targetId) ?? dto.targetId,
    type: dto.type,
    data: dto.data,
    properties: dto.properties,
    sandbox,
  };
}

/**
 * Fallback when the RF edge is not (yet) mirrored in graphEdges,
 * e.g. a sandbox edge just created locally.
 */
export function selectedEdgeFromFlowEdge(
  edge: FlowEdgeLike,
  labelById: Map<string, string>,
  sandbox = false
): SelectedEdgeDetails | null {
  if (edge.data?.indirect) return null;
  const sourceId = String(edge.source);
  const targetId = String(edge.target);
  return {
    id: edge.id,
    sourceId,
    targetId,
    sourceLabel: labelById.get(sourceId) ?? sourceId,
    targetLabel: labelById.get(targetId) ?? targetId,
    type: edge.data?.relation ?? 'DEPENDS_ON',
    data: edge.data?.dataKey ?? null,
    properties: edge.data?.properties,
    sandbox,
  };
}

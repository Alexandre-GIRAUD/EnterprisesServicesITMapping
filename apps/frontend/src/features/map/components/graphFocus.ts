import type { Edge } from '@xyflow/react';

export type FocusSets = {
  nodeIds: Set<string>;
  edgeIds: Set<string>;
};

/**
 * Compute the direct focus neighborhood for a node: itself plus every node
 * reachable in exactly one hop (incoming or outgoing edge), and all those
 * adjacent edges.
 *
 * Only 1-hop neighbors are included so that the rest of the diagram dims
 * while the immediate context of the focused node stays visible.
 */
export function computeFocus(edges: Edge[], focusId: string): FocusSets {
  const nodeIds = new Set<string>([focusId]);
  const edgeIds = new Set<string>();

  for (const edge of edges) {
    if (edge.source === focusId) {
      edgeIds.add(edge.id);
      nodeIds.add(edge.target);
    } else if (edge.target === focusId) {
      edgeIds.add(edge.id);
      nodeIds.add(edge.source);
    }
  }

  return { nodeIds, edgeIds };
}

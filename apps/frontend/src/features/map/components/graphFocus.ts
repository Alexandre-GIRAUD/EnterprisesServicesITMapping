import type { Edge } from '@xyflow/react';

export type FocusSets = {
  nodeIds: Set<string>;
  edgeIds: Set<string>;
};

/** self: the node under the cursor or open in the drawer; neighbor: one hop away; faded: the rest. */
export type FocusTier = 'self' | 'neighbor' | 'faded';

const TIER_CLASS: Record<FocusTier, string> = {
  self: 'is-focus is-focus-self',
  neighbor: 'is-focus',
  faded: 'is-faded',
};

export function focusTier(focus: FocusSets | null, focusId: string | null, nodeId: string): FocusTier | null {
  if (!focus || !focusId) return null;
  if (nodeId === focusId) return 'self';
  return focus.nodeIds.has(nodeId) ? 'neighbor' : 'faded';
}

export function tierClassName(tier: FocusTier | null): string | undefined {
  return tier ? TIER_CLASS[tier] : undefined;
}

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

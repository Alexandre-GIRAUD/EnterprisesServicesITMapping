import type { Edge } from '@xyflow/react';

export type FocusSets = {
  nodeIds: Set<string>;
  edgeIds: Set<string>;
};

/**
 * Compute the focus neighborhood for a node: itself, all transitive ancestors
 * (following edges backward) and descendants (following edges forward), plus
 * every edge lying on those connecting paths.
 *
 * Directed BFS in both orientations over an adjacency list built from `edges`.
 * Complexity O(V + E); each edge is visited at most once per direction.
 */
export function computeFocus(edges: Edge[], focusId: string): FocusSets {
  const outgoing = new Map<string, Edge[]>();
  const incoming = new Map<string, Edge[]>();
  for (const edge of edges) {
    (outgoing.get(edge.source) ?? outgoing.set(edge.source, []).get(edge.source)!).push(edge);
    (incoming.get(edge.target) ?? incoming.set(edge.target, []).get(edge.target)!).push(edge);
  }

  const nodeIds = new Set<string>([focusId]);
  const edgeIds = new Set<string>();

  const walk = (adjacency: Map<string, Edge[]>, next: (e: Edge) => string) => {
    const queue = [focusId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of adjacency.get(current) ?? []) {
        edgeIds.add(edge.id);
        const neighbor = next(edge);
        if (!nodeIds.has(neighbor)) {
          nodeIds.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  };

  walk(outgoing, (e) => e.target);
  walk(incoming, (e) => e.source);

  return { nodeIds, edgeIds };
}

import type { GraphResponseDto } from '@/types/api';

/**
 * Widens a filtered graph with every node linked by at least one feed to a filtered node,
 * along with those feeds. `full` is the unfiltered graph the neighbours are read from.
 */
export function withNeighbours(selected: GraphResponseDto, full: GraphResponseDto): GraphResponseDto {
  const selectedIds = new Set(selected.nodes.map((node) => node.id));
  const edges = full.edges.filter((edge) => selectedIds.has(edge.sourceId) || selectedIds.has(edge.targetId));
  const keptIds = new Set([...selectedIds, ...edges.flatMap((edge) => [edge.sourceId, edge.targetId])]);
  return { nodes: full.nodes.filter((node) => keptIds.has(node.id)), edges };
}

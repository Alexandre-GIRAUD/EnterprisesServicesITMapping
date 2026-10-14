import type { GraphFilters } from '@/types/api';

/** Null when this answer does not change the map. An empty object clears every filter. */
export function appliedFiltersFromChat(
  applied: GraphFilters | null | undefined
): GraphFilters | null {
  if (applied == null) return null;
  return {
    applicationIds: applied.applicationIds ?? [],
    nodeAttributes: applied.nodeAttributes ?? {},
    nodeRefs: applied.nodeRefs ?? {},
    edgeAttributes: applied.edgeAttributes ?? {},
  };
}

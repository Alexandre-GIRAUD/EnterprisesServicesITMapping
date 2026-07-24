/**
 * Pure collapse/expand projection for the application graph.
 *
 * Hidden nodes are removed from the view; paths that went through them become
 * dashed "indirect" edges between the remaining endpoints. Expand restores
 * every hidden node associated with a clicked indirect edge.
 */

export type CollapseEdgeInput = {
  id: string;
  sourceId: string;
  targetId: string;
};

export type ProjectedEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  kind: 'real' | 'indirect';
  /** Hidden application ids encapsulated by this edge (empty for real). */
  hiddenNodeIds: string[];
  /** Real edge ids that participate in the path (debugging / future use). */
  pathEdgeIds: string[];
};

export function indirectEdgeId(sourceId: string, targetId: string): string {
  return `indirect:${sourceId}->${targetId}`;
}

export function isIndirectEdgeId(id: string): boolean {
  return id.startsWith('indirect:');
}

const MAX_QUEUE_STEPS = 5000;

/**
 * Project a graph after hiding some nodes.
 *
 * - Visible nodes = all nodes − hidden
 * - Real edges with both ends visible are kept as-is
 * - Paths `visible → (hidden+) → visible` become a single indirect edge
 * - If a real edge already exists for a pair, no indirect duplicate is created
 * - Multiple hidden paths between the same pair merge their `hiddenNodeIds`
 */
export function projectCollapsedGraph(
  nodeIds: string[],
  edges: CollapseEdgeInput[],
  hiddenNodeIds: ReadonlySet<string>
): { visibleNodeIds: string[]; edges: ProjectedEdge[] } {
  const visibleNodeIds = nodeIds.filter((id) => !hiddenNodeIds.has(id));
  const visibleSet = new Set(visibleNodeIds);

  const realEdges: ProjectedEdge[] = [];
  const realPairKeys = new Set<string>();

  for (const edge of edges) {
    if (hiddenNodeIds.has(edge.sourceId) || hiddenNodeIds.has(edge.targetId)) continue;
    realEdges.push({
      id: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      kind: 'real',
      hiddenNodeIds: [],
      pathEdgeIds: [edge.id],
    });
    realPairKeys.add(pairKey(edge.sourceId, edge.targetId));
  }

  if (hiddenNodeIds.size === 0) {
    return { visibleNodeIds, edges: realEdges };
  }

  const adj = new Map<string, { targetId: string; edgeId: string }[]>();
  for (const edge of edges) {
    const list = adj.get(edge.sourceId);
    if (list) list.push({ targetId: edge.targetId, edgeId: edge.id });
    else adj.set(edge.sourceId, [{ targetId: edge.targetId, edgeId: edge.id }]);
  }

  type PathHit = { hiddenNodeIds: string[]; pathEdgeIds: string[] };
  const virtualByKey = new Map<string, PathHit>();

  for (const startId of visibleNodeIds) {
    const queue: { nodeId: string; hiddenOnPath: string[]; pathEdgeIds: string[] }[] = [];

    for (const step of adj.get(startId) ?? []) {
      if (visibleSet.has(step.targetId)) continue;
      if (!hiddenNodeIds.has(step.targetId)) continue;
      queue.push({
        nodeId: step.targetId,
        hiddenOnPath: [step.targetId],
        pathEdgeIds: [step.edgeId],
      });
    }

    let steps = 0;
    while (queue.length > 0 && steps < MAX_QUEUE_STEPS) {
      steps += 1;
      const cur = queue.shift()!;

      for (const step of adj.get(cur.nodeId) ?? []) {
        const t = step.targetId;
        const nextPathIds = [...cur.pathEdgeIds, step.edgeId];

        if (visibleSet.has(t)) {
          if (t === startId) continue;
          const key = pairKey(startId, t);
          if (realPairKeys.has(key)) continue;

          const existing = virtualByKey.get(key);
          if (existing) {
            virtualByKey.set(key, {
              hiddenNodeIds: uniqueConcat(existing.hiddenNodeIds, cur.hiddenOnPath),
              pathEdgeIds: uniqueConcat(existing.pathEdgeIds, nextPathIds),
            });
          } else {
            virtualByKey.set(key, {
              hiddenNodeIds: [...cur.hiddenOnPath],
              pathEdgeIds: nextPathIds,
            });
          }
          continue;
        }

        if (hiddenNodeIds.has(t) && !cur.hiddenOnPath.includes(t)) {
          queue.push({
            nodeId: t,
            hiddenOnPath: [...cur.hiddenOnPath, t],
            pathEdgeIds: nextPathIds,
          });
        }
      }
    }
  }

  const virtualEdges: ProjectedEdge[] = [];
  for (const [key, hit] of virtualByKey) {
    const sep = key.indexOf('\0');
    const sourceId = key.slice(0, sep);
    const targetId = key.slice(sep + 1);
    virtualEdges.push({
      id: indirectEdgeId(sourceId, targetId),
      sourceId,
      targetId,
      kind: 'indirect',
      hiddenNodeIds: hit.hiddenNodeIds,
      pathEdgeIds: hit.pathEdgeIds,
    });
  }

  virtualEdges.sort((a, b) => a.id.localeCompare(b.id));

  return { visibleNodeIds, edges: [...realEdges, ...virtualEdges] };
}

function pairKey(sourceId: string, targetId: string): string {
  return `${sourceId}\0${targetId}`;
}

function uniqueConcat(a: string[], b: string[]): string[] {
  const out = [...a];
  for (const id of b) {
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

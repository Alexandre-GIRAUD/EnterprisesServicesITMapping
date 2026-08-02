import type { GraphEdgeDto, GraphNodeDto } from '@/types/api';
import {
  buildAppEdge,
  buildAppNode,
  NODE_HEIGHT,
  NODE_WIDTH,
  type AppNode,
  type NodeCodingKeys,
} from '../hooks/useGraphData';
import type { LegendColorMaps } from './edgeColorProperty';
import { computeBridges } from './bridges';
import { projectCollapsedGraph } from './collapseGraph';
import { elkLayout } from './elkLayout';
import { layoutGraph } from './graphLayout';
import { attachRoute, buildOrientedEdge } from './orientedEdgeBuilders';
import type { OrientedEdgeData, OrientedEdgeType } from './OrientedEdge';

export type CollapseLayoutHandlers = {
  onHideNode: (nodeId: string) => void;
  onExpandHidden: (hiddenNodeIds: string[]) => void;
};

export type NodePositionsMap = Record<string, { x: number; y: number }>;

const FALLBACK_OFFSET_X = NODE_WIDTH + 40;

function buildAdjacency(edges: GraphEdgeDto[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    let set = adj.get(a);
    if (!set) {
      set = new Set();
      adj.set(a, set);
    }
    set.add(b);
  };
  for (const e of edges) {
    link(e.sourceId, e.targetId);
    link(e.targetId, e.sourceId);
  }
  return adj;
}

function midpointFromPositions(positions: Array<{ x: number; y: number }>): { x: number; y: number } {
  let cx = 0;
  let cy = 0;
  for (const p of positions) {
    cx += p.x + NODE_WIDTH / 2;
    cy += p.y + NODE_HEIGHT / 2;
  }
  const n = positions.length;
  return {
    x: cx / n - NODE_WIDTH / 2,
    y: cy / n - NODE_HEIGHT / 2,
  };
}

function offsetFromNeighbor(pos: { x: number; y: number }): { x: number; y: number } {
  return { x: pos.x + FALLBACK_OFFSET_X, y: pos.y };
}

/**
 * Resolve positions for every visible node without moving nodes that already
 * have a known position. Missing nodes use midpoint of positioned neighbors,
 * else an offset from a single neighbor, else the centroid of known positions.
 */
export function resolvePreservedPositions(
  visibleIds: readonly string[],
  graphEdges: GraphEdgeDto[],
  known: NodePositionsMap
): NodePositionsMap {
  const result: NodePositionsMap = {};
  for (const id of visibleIds) {
    const saved = known[id];
    if (saved) result[id] = { x: saved.x, y: saved.y };
  }

  const missing = visibleIds.filter((id) => result[id] == null);
  if (missing.length === 0) return result;

  const adj = buildAdjacency(graphEdges);
  let progressed = true;
  while (missing.length > 0 && progressed) {
    progressed = false;
    for (let i = missing.length - 1; i >= 0; i -= 1) {
      const id = missing[i]!;
      const neighborPositions: Array<{ x: number; y: number }> = [];
      for (const nid of adj.get(id) ?? []) {
        const p = result[nid];
        if (p) neighborPositions.push(p);
      }
      if (neighborPositions.length >= 2) {
        result[id] = midpointFromPositions(neighborPositions);
        missing.splice(i, 1);
        progressed = true;
      } else if (neighborPositions.length === 1) {
        result[id] = offsetFromNeighbor(neighborPositions[0]!);
        missing.splice(i, 1);
        progressed = true;
      }
    }
  }

  if (missing.length > 0) {
    const knownList = Object.values(result);
    const fallback =
      knownList.length > 0 ? midpointFromPositions(knownList) : { x: 0, y: 0 };
    for (const id of missing) {
      result[id] = { ...fallback };
    }
  }

  return result;
}

/**
 * Project the full graph through the hidden-node set, then layout.
 * When {@link nodePositions} is provided, visible nodes keep those coordinates
 * (with neighbor-based fallback for unknowns) and ELK is skipped so remaining
 * apps do not jump — only edges change. Edge routes are left for OrientedEdge
 * live recalculation.
 * Tables should keep using the unprojected `graphNodes` / `graphEdges`.
 */
export async function layoutCollapsedAppGraph(params: {
  graphNodes: GraphNodeDto[];
  graphEdges: GraphEdgeDto[];
  hiddenNodeIds: ReadonlySet<string>;
  colorPropertyKey: string;
  labelPropertyKey?: string;
  nodeCoding?: NodeCodingKeys;
  colors?: LegendColorMaps;
  aspectRatio: number;
  handlers: CollapseLayoutHandlers;
  /** Optional canvas positions to preserve (visible + newly restored). */
  nodePositions?: NodePositionsMap;
}): Promise<{ nodes: AppNode[]; edges: OrientedEdgeType[] }> {
  const {
    graphNodes,
    graphEdges,
    hiddenNodeIds,
    colorPropertyKey,
    labelPropertyKey = 'data',
    nodeCoding,
    colors,
    aspectRatio,
    handlers,
    nodePositions,
  } = params;
  const hasSavedPositions = Boolean(nodePositions && Object.keys(nodePositions).length > 0);

  const projected = projectCollapsedGraph(
    graphNodes.map((n) => n.id),
    graphEdges.map((e) => ({ id: e.id, sourceId: e.sourceId, targetId: e.targetId })),
    hiddenNodeIds
  );

  const visibleSet = new Set(projected.visibleNodeIds);
  const visibleDtos = graphNodes.filter((n) => visibleSet.has(n.id));
  const edgeById = new Map(graphEdges.map((e) => [e.id, e]));
  const typeById = new Map(visibleDtos.map((n) => [n.id, n.type]));

  const baseNodes: AppNode[] = visibleDtos.map((n) => {
    const node = buildAppNode(n, nodeCoding);
    return {
      ...node,
      data: {
        ...node.data,
        onHide: () => handlers.onHideNode(n.id),
      },
    };
  });

  const builtEdges: OrientedEdgeType[] = projected.edges.map((pe) => {
    if (pe.kind === 'real') {
      const dto = edgeById.get(pe.id);
      if (!dto) {
        return buildOrientedEdge({
          id: pe.id,
          sourceId: pe.sourceId,
          targetId: pe.targetId,
          relationType: 'DEPENDS_ON',
          sourceNodeType: typeById.get(pe.sourceId) ?? 'Application',
          targetNodeType: typeById.get(pe.targetId) ?? 'Application',
          colorPropertyKey,
          labelPropertyKey,
          colors,
        });
      }
      return buildAppEdge(dto, typeById, colorPropertyKey, labelPropertyKey, colors);
    }

    const hiddenNodeIdsForEdge = [...pe.hiddenNodeIds];
    const edge = buildOrientedEdge({
      id: pe.id,
      sourceId: pe.sourceId,
      targetId: pe.targetId,
      relationType: 'DEPENDS_ON',
      sourceNodeType: typeById.get(pe.sourceId) ?? 'Application',
      targetNodeType: typeById.get(pe.targetId) ?? 'Application',
      dataLabel: 'Indirect',
      colorPropertyKey,
      labelPropertyKey,
      colorValue: null,
      colors,
    });

    const data: OrientedEdgeData = {
      ...edge.data!,
      dashed: true,
      indirect: true,
      hiddenNodeIds: hiddenNodeIdsForEdge,
      dataLabel: 'Indirect',
      onExpand: () => handlers.onExpandHidden(hiddenNodeIdsForEdge),
    };

    return {
      ...edge,
      label: '+',
      data,
    };
  });

  if (hasSavedPositions && nodePositions) {
    const resolved = resolvePreservedPositions(
      projected.visibleNodeIds,
      graphEdges,
      nodePositions
    );
    const positioned = baseNodes.map((n) => ({
      ...n,
      position: resolved[n.id] ?? { x: 0, y: 0 },
    }));
    return { nodes: positioned, edges: builtEdges };
  }

  let positioned: AppNode[];
  let routedEdges: OrientedEdgeType[];

  try {
    const { nodes: laidOut, routes } = await elkLayout(baseNodes, builtEdges, {
      nodeWidth: NODE_WIDTH,
      nodeHeight: NODE_HEIGHT,
      nodeSeparation: 70,
      layerSeparation: 100,
      aspectRatio,
    });
    positioned = laidOut;
    const jumps = computeBridges(routes);
    routedEdges = builtEdges.map((e) => attachRoute(e, routes.get(e.id), jumps.get(e.id)));
  } catch {
    positioned = layoutGraph(baseNodes, builtEdges, {
      nodeWidth: NODE_WIDTH,
      nodeHeight: NODE_HEIGHT,
      nodeSeparation: 70,
      rankSeparation: 100,
      snapGrid: 16,
      aspectRatio,
    });
    routedEdges = builtEdges;
  }

  return { nodes: positioned, edges: routedEdges };
}

import type { GraphEdgeDto, GraphNodeDto } from '@/types/api';
import { buildAppEdge, buildAppNode, NODE_HEIGHT, NODE_WIDTH, type AppNode } from '../hooks/useGraphData';
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

/**
 * Project the full graph through the hidden-node set, then run ELK (dagre fallback).
 * Tables should keep using the unprojected `graphNodes` / `graphEdges`.
 */
export async function layoutCollapsedAppGraph(params: {
  graphNodes: GraphNodeDto[];
  graphEdges: GraphEdgeDto[];
  hiddenNodeIds: ReadonlySet<string>;
  colorPropertyKey: string;
  aspectRatio: number;
  handlers: CollapseLayoutHandlers;
}): Promise<{ nodes: AppNode[]; edges: OrientedEdgeType[] }> {
  const { graphNodes, graphEdges, hiddenNodeIds, colorPropertyKey, aspectRatio, handlers } = params;

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
    const node = buildAppNode(n);
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
        });
      }
      return buildAppEdge(dto, typeById, colorPropertyKey);
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
      colorValue: null,
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

  try {
    const { nodes: laidOut, routes } = await elkLayout(baseNodes, builtEdges, {
      nodeWidth: NODE_WIDTH,
      nodeHeight: NODE_HEIGHT,
      nodeSeparation: 70,
      layerSeparation: 100,
      aspectRatio,
    });
    const jumps = computeBridges(routes);
    return {
      nodes: laidOut,
      edges: builtEdges.map((e) => attachRoute(e, routes.get(e.id), jumps.get(e.id))),
    };
  } catch {
    return {
      nodes: layoutGraph(baseNodes, builtEdges, {
        nodeWidth: NODE_WIDTH,
        nodeHeight: NODE_HEIGHT,
        nodeSeparation: 70,
        rankSeparation: 100,
        snapGrid: 16,
        aspectRatio,
      }),
      edges: builtEdges,
    };
  }
}

import type { ELK as ElkInstance, ElkNode } from 'elkjs/lib/elk-api';
import { Position, type Edge, type Node } from '@xyflow/react';

export type Point = { x: number; y: number };

export type ElkLayoutResult<N extends Node> = {
  nodes: N[];
  routes: Map<string, Point[]>;
};

export type ElkLayoutOptions = {
  nodeWidth?: number;
  nodeHeight?: number;
  nodeSeparation?: number;
  layerSeparation?: number;
  direction?: 'DOWN' | 'RIGHT' | 'UP' | 'LEFT';
  aspectRatio?: number;
};

function buildLayoutOptions(opts: {
  nodeSeparation: number;
  layerSeparation: number;
  direction: string;
  aspectRatio?: number;
}): Record<string, string> {
  const layoutOptions: Record<string, string> = {
    'elk.algorithm': 'layered',
    'elk.direction': opts.direction,
    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
    'elk.portConstraints': 'FREE',
    'elk.layered.mergeEdges': 'false',
    'elk.layered.allowNonFlowPortsToSwitchSides': 'true',
    'elk.layered.nodePlacement.favorStraightEdges': 'true',
    'elk.spacing.nodeNode': String(opts.nodeSeparation),
    'elk.layered.spacing.nodeNodeBetweenLayers': String(opts.layerSeparation),
    'elk.spacing.edgeEdge': '16',
    'elk.spacing.edgeNode': '28',
    'elk.layered.spacing.edgeEdgeBetweenLayers': '16',
    'elk.layered.spacing.edgeNodeBetweenLayers': '28',
    'elk.spacing.edgeLabel': '14',
    'elk.layered.spacing.edgeLabelBetweenLayers': '14',
    'elk.spacing.portPort': '16',
    'elk.layered.layering.strategy': 'NETWORK_SIMPLEX',
    'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    'elk.layered.cycleBreaking.strategy': 'GREEDY',
    'elk.layered.compaction.postCompaction.strategy': 'EDGE_LENGTH',
    'elk.layered.unnecessaryBendpoints': 'true',
    'elk.separateConnectedComponents': 'true',
  };
  if (opts.aspectRatio && Number.isFinite(opts.aspectRatio)) {
    layoutOptions['elk.aspectRatio'] = String(opts.aspectRatio);
  }
  return layoutOptions;
}

let elkPromise: Promise<ElkInstance> | null = null;
function getElk(): Promise<ElkInstance> {
  if (!elkPromise) {
    elkPromise = import('elkjs/lib/elk.bundled.js').then((mod) => new mod.default());
  }
  return elkPromise;
}

export async function elkLayout<N extends Node>(
  nodes: N[],
  edges: Edge[],
  options: ElkLayoutOptions = {}
): Promise<ElkLayoutResult<N>> {
  const {
    nodeWidth = 160,
    nodeHeight = 48,
    nodeSeparation = 90,
    layerSeparation = 120,
    direction = 'DOWN',
    aspectRatio,
  } = options;

  const graph: ElkNode = {
    id: 'root',
    layoutOptions: buildLayoutOptions({ nodeSeparation, layerSeparation, direction, aspectRatio }),
    children: nodes.map((n) => ({
      id: n.id,
      width: n.width ?? nodeWidth,
      height: n.height ?? nodeHeight,
      layoutOptions: { 'elk.portConstraints': 'FREE' },
    })),
    edges: edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  };

  const elk = await getElk();
  const laidOut = await elk.layout(graph);

  const positionById = new Map<string, { x: number; y: number }>();
  for (const child of laidOut.children ?? []) {
    positionById.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 });
  }

  const routes = new Map<string, Point[]>();
  for (const edge of laidOut.edges ?? []) {
    const section = edge.sections?.[0];
    if (!section) continue;
    const points: Point[] = [
      section.startPoint,
      ...(section.bendPoints ?? []),
      section.endPoint,
    ].map((p) => ({ x: p.x, y: p.y }));
    routes.set(edge.id, points);
  }

  // Build per-node edge lists to derive actual anchor directions.
  const edgesBySource = new Map<string, Edge[]>();
  const edgesByTarget = new Map<string, Edge[]>();
  for (const edge of edges) {
    if (!edgesBySource.has(edge.source)) edgesBySource.set(edge.source, []);
    if (!edgesByTarget.has(edge.target)) edgesByTarget.set(edge.target, []);
    edgesBySource.get(edge.source)!.push(edge);
    edgesByTarget.get(edge.target)!.push(edge);
  }

  function segmentToPosition(from: Point, to: Point): Position {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? Position.Right : Position.Left;
    return dy >= 0 ? Position.Bottom : Position.Top;
  }

  function dominantPosition(positions: Position[], fallback: Position): Position {
    if (positions.length === 0) return fallback;
    const counts = new Map<Position, number>();
    for (const p of positions) counts.set(p, (counts.get(p) ?? 0) + 1);
    let best = fallback;
    let bestCount = 0;
    for (const [pos, count] of counts) {
      if (count > bestCount) { best = pos; bestCount = count; }
    }
    return best;
  }

  const oppositeOf: Record<Position, Position> = {
    [Position.Right]: Position.Left,
    [Position.Left]: Position.Right,
    [Position.Bottom]: Position.Top,
    [Position.Top]: Position.Bottom,
  };

  const positionedNodes = nodes.map((node) => {
    const pos = positionById.get(node.id) ?? { x: 0, y: 0 };

    const srcPositions = (edgesBySource.get(node.id) ?? []).flatMap((e) => {
      const route = routes.get(e.id);
      if (!route || route.length < 2) return [];
      return [segmentToPosition(route[0], route[1])];
    });

    const tgtPositions = (edgesByTarget.get(node.id) ?? []).flatMap((e) => {
      const route = routes.get(e.id);
      if (!route || route.length < 2) return [];
      return [oppositeOf[segmentToPosition(route[route.length - 2], route[route.length - 1])]];
    });

    return {
      ...node,
      position: { x: pos.x, y: pos.y },
      sourcePosition: dominantPosition(srcPositions, Position.Bottom),
      targetPosition: dominantPosition(tgtPositions, Position.Top),
    };
  });

  return { nodes: positionedNodes, routes };
}

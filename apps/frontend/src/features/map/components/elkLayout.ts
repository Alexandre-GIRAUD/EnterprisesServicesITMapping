import type { ELK as ElkInstance, ElkNode } from 'elkjs/lib/elk-api';
import { Position, type Edge, type Node } from '@xyflow/react';

export type Point = { x: number; y: number };

export type ElkLayoutResult<N extends Node> = {
  nodes: N[];
  /** Full orthogonal route (start + bend points + end) per edge id, in flow coords. */
  routes: Map<string, Point[]>;
};

export type ElkLayoutOptions = {
  nodeWidth?: number;
  nodeHeight?: number;
  /** Spacing between sibling nodes in the same layer. */
  nodeSeparation?: number;
  /** Spacing between layers (ranks). */
  layerSeparation?: number;
};

// Lazily load the (~1.4 MB) ELK bundle so it is code-split into its own chunk
// and only fetched the first time a graph is laid out.
let elkPromise: Promise<ElkInstance> | null = null;
function getElk(): Promise<ElkInstance> {
  if (!elkPromise) {
    elkPromise = import('elkjs/lib/elk.bundled.js').then((mod) => new mod.default());
  }
  return elkPromise;
}

/**
 * Hierarchical layout with true node-avoiding orthogonal edge routing via ELK's
 * `layered` algorithm (`elk.edgeRouting: ORTHOGONAL`). Unlike dagre, ELK routes
 * edges around node boxes and returns explicit bend points, so edges never run
 * across a node's face. Returns React Flow nodes positioned top-left plus the
 * routed poly-lines for the custom edge renderer.
 */
export async function elkLayout<N extends Node>(
  nodes: N[],
  edges: Edge[],
  options: ElkLayoutOptions = {}
): Promise<ElkLayoutResult<N>> {
  const {
    nodeWidth = 160,
    nodeHeight = 48,
    nodeSeparation = 70,
    layerSeparation = 100,
  } = options;

  const graph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.spacing.nodeNodeBetweenLayers': String(layerSeparation),
      'elk.spacing.nodeNode': String(nodeSeparation),
      'elk.spacing.edgeNode': '24',
      'elk.layered.spacing.edgeNodeBetweenLayers': '24',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.mergeEdges': 'false',
    },
    children: nodes.map((n) => ({
      id: n.id,
      width: n.width ?? nodeWidth,
      height: n.height ?? nodeHeight,
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

  const positionedNodes = nodes.map((node) => {
    const pos = positionById.get(node.id) ?? { x: 0, y: 0 };
    return {
      ...node,
      position: { x: pos.x, y: pos.y },
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom,
    };
  });

  return { nodes: positionedNodes, routes };
}

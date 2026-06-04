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
  /**
   * Minimum gap between sibling nodes in the same layer.
   * Generous default (90) prevents crowding and gives edge labels room.
   */
  nodeSeparation?: number;
  /**
   * Minimum gap between consecutive layers (ranks).
   * Generous default (120) keeps tier lines clean and readable.
   */
  layerSeparation?: number;
  /** Dominant flow direction of the layered algorithm. */
  direction?: 'DOWN' | 'RIGHT' | 'UP' | 'LEFT';
  /** Target width/height ratio so the layout fills the viewport homogeneously. */
  aspectRatio?: number;
};

/**
 * Universal, data-agnostic ELK option set. Every rule is encoded here so any
 * node/edge JSON is handled consistently — no per-graph tweaking required.
 *
 *  Grid alignment (Rule 1): `nodePlacement.bk.fixedAlignment=BALANCED` centers
 *  nodes symmetrically within their rank so same-tier nodes always share the
 *  same axis coordinate, giving a clean grid appearance.
 *
 *  Smart 4-side anchoring (Rule 2): per-node `portConstraints=FREE` +
 *  `allowNonFlowPortsToSwitchSides=true` let ELK choose whichever side
 *  (top/bottom/left/right) minimises path length and bend count for each edge.
 *  `mergeEdges=false` + generous port/edge gaps keep every anchor distinct.
 *
 *  Clear separation (Rule 3): `NETWORK_SIMPLEX` layering and placement minimise
 *  total edge length and keep strongly-linked nodes close. `EDGE_LENGTH`
 *  compaction shortens long-distance edges that skip tiers and reduces bends.
 *  Edge-label spacing (`spacing.edgeLabel`, `spacing.edgeLabelBetweenLayers`)
 *  prevents relation labels from touching node borders or other text.
 *
 *  Node avoidance: `edgeRouting=ORTHOGONAL` routes every edge around boxes.
 */
function buildLayoutOptions(opts: {
  nodeSeparation: number;
  layerSeparation: number;
  direction: string;
  aspectRatio?: number;
}): Record<string, string> {
  const layoutOptions: Record<string, string> = {
    // ----- Core algorithm -----
    'elk.algorithm': 'layered',
    'elk.direction': opts.direction,
    'elk.edgeRouting': 'ORTHOGONAL',

    // ----- Rule 1 — Grid alignment -----
    // BALANCED: nodes center-aligned within each layer → same-tier nodes share
    // the same horizontal (DOWN) or vertical (RIGHT) coordinate.
    'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',

    // ----- Rule 2 — 4-side smart anchoring -----
    'elk.portConstraints': 'FREE',
    'elk.layered.mergeEdges': 'false',
    'elk.layered.allowNonFlowPortsToSwitchSides': 'true',
    // Prefer straight segments; ELK will deviate only when a shorter/cleaner
    // path exists via a different side.
    'elk.layered.nodePlacement.favorStraightEdges': 'true',

    // ----- Rule 3 — Spacing: prevent crowding and label collisions -----
    'elk.spacing.nodeNode': String(opts.nodeSeparation),
    'elk.layered.spacing.nodeNodeBetweenLayers': String(opts.layerSeparation),
    // Gap between parallel edges (and between an edge and a node border).
    'elk.spacing.edgeEdge': '16',
    'elk.spacing.edgeNode': '28',
    'elk.layered.spacing.edgeEdgeBetweenLayers': '16',
    'elk.layered.spacing.edgeNodeBetweenLayers': '28',
    // Gap between a relation label and its adjacent node/edge — prevents
    // labels touching node borders or overlapping nearby text.
    'elk.spacing.edgeLabel': '14',
    'elk.layered.spacing.edgeLabelBetweenLayers': '14',
    // Distinct port spacing along each node border.
    'elk.spacing.portPort': '16',

    // ----- Rule 3 — Compaction & crossing minimisation -----
    'elk.layered.layering.strategy': 'NETWORK_SIMPLEX',
    'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    'elk.layered.cycleBreaking.strategy': 'GREEDY',
    // EDGE_LENGTH compaction shortens long-distance skip-layer edges and
    // removes unnecessary bends — better than LEFT for professional diagrams.
    'elk.layered.compaction.postCompaction.strategy': 'EDGE_LENGTH',
    'elk.layered.unnecessaryBendpoints': 'true',
    'elk.separateConnectedComponents': 'true',
  };

  if (opts.aspectRatio && Number.isFinite(opts.aspectRatio)) {
    layoutOptions['elk.aspectRatio'] = String(opts.aspectRatio);
  }
  return layoutOptions;
}

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
    nodeSeparation = 90,
    layerSeparation = 120,
    direction = 'DOWN',
    aspectRatio,
  } = options;

  const graph: ElkNode = {
    id: 'root',
    layoutOptions: buildLayoutOptions({
      nodeSeparation,
      layerSeparation,
      direction,
      aspectRatio,
    }),
    children: nodes.map((n) => ({
      id: n.id,
      width: n.width ?? nodeWidth,
      height: n.height ?? nodeHeight,
      // FREE per node so each edge can dock on whichever of the 4 sides is best.
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

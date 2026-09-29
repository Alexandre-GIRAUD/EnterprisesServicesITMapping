import type { Edge, Node } from '@xyflow/react';
import { instance } from '@viz-js/viz';
import { elkLayout, type ElkLayoutOptions, type ElkLayoutResult, type Point } from './elkLayout';
import { buildDot, parsePlainLayout } from './graphvizPlain';

const DEFAULT_NODE_WIDTH = 160;
const DEFAULT_NODE_HEIGHT = 48;

let vizPromise: ReturnType<typeof instance> | null = null;

/** Place nodes and orthogonal edges with Graphviz. Throws if Graphviz cannot render. */
export async function graphvizLayout<N extends Node>(
  nodes: N[],
  edges: Edge[],
  options: ElkLayoutOptions = {},
): Promise<ElkLayoutResult<N>> {
  if (nodes.length === 0) return { nodes, routes: new Map() };

  const nodeWidth = options.nodeWidth ?? DEFAULT_NODE_WIDTH;
  const nodeHeight = options.nodeHeight ?? DEFAULT_NODE_HEIGHT;
  const dot = buildDot(
    nodes.map((node) => ({ id: node.id })),
    edges.map((edge) => ({ source: edge.source, target: edge.target })),
    nodeWidth,
    nodeHeight,
  );
  if (!vizPromise) vizPromise = instance();
  const viz = await vizPromise;
  const plain = viz.renderString(dot, { format: 'plain', engine: 'dot', yInvert: true });
  const parsed = parsePlainLayout(plain);
  const placed = [...parsed.positions.values()];
  const hasFinitePositions = placed.every((position) => Number.isFinite(position.x) && Number.isFinite(position.y));
  if (!hasFinitePositions || nodes.some((node) => !parsed.positions.has(node.id))) {
    throw new Error('Graphviz did not place every node');
  }

  const routes = new Map<string, Point[]>();
  const usedRouteIndexes = new Set<number>();
  for (const edge of edges) {
    const routeIndex = parsed.edgeRoutes.findIndex(
      (route, index) =>
        !usedRouteIndexes.has(index) && route.tail === edge.source && route.head === edge.target,
    );
    if (routeIndex < 0) continue;
    usedRouteIndexes.add(routeIndex);
    const points = parsed.edgeRoutes[routeIndex]?.points;
    if (points && points.length > 0) routes.set(edge.id, points);
  }

  return {
    nodes: nodes.map((node) => ({
      ...node,
      position: parsed.positions.get(node.id) ?? node.position,
    })),
    routes,
  };
}

/** Graphviz first. ELK when Graphviz does not answer. */
export async function placeApplicationGraph<N extends Node>(
  nodes: N[],
  edges: Edge[],
  options: ElkLayoutOptions = {},
): Promise<ElkLayoutResult<N>> {
  try {
    return await graphvizLayout(nodes, edges, options);
  } catch {
    // Graphviz can fail to load or refuse a graph. ELK is the next layout; dagre stays in the callers.
    return elkLayout(nodes, edges, options);
  }
}

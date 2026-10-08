import type { Edge, Node } from '@xyflow/react';
import { instance } from '@viz-js/viz';
import { elkLayout, type ElkLayoutOptions, type ElkLayoutResult, type Point } from './elkLayout';
import {
  COMPONENT_GAP,
  findConnectedComponents,
  normalizeComponentLayout,
  packComponentOffsets,
  translateComponentLayout,
} from './graphComponents';
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

  const placedNodes = nodes.map((node) => ({
    ...node,
    position: parsed.positions.get(node.id) ?? node.position,
  }));
  return repackIslands(placedNodes, edges, routes, nodeWidth, nodeHeight, options.aspectRatio);
}

function repackIslands<N extends Node>(
  nodes: N[],
  edges: Edge[],
  routes: Map<string, Point[]>,
  nodeWidth: number,
  nodeHeight: number,
  aspectRatio?: number,
): ElkLayoutResult<N> {
  const components = findConnectedComponents(
    nodes.map((node) => node.id),
    edges.map((edge) => ({ source: edge.source, target: edge.target })),
  );
  if (components.length <= 1) return { nodes, routes };

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const bounds: { width: number; height: number }[] = [];
  const parts: {
    nodeIds: string[];
    edgeIds: string[];
    positions: Map<string, { x: number; y: number }>;
    routes: Map<string, Point[]>;
    nodes: N[];
  }[] = [];

  for (const nodeIds of components) {
    const idSet = new Set(nodeIds);
    const compNodes = nodeIds
      .map((id) => nodeById.get(id))
      .filter((node): node is N => node !== undefined);
    const edgeIds = edges.filter((edge) => idSet.has(edge.source) && idSet.has(edge.target)).map((edge) => edge.id);
    const positions = new Map(compNodes.map((node) => [node.id, { ...node.position }]));
    const compRoutes = new Map(edgeIds.map((id) => [id, routes.get(id) ?? []]));
    const size = normalizeComponentLayout(nodeIds, positions, compRoutes, compNodes, nodeWidth, nodeHeight);
    bounds.push(size);
    parts.push({ nodeIds, edgeIds, positions, routes: compRoutes, nodes: compNodes });
  }

  const offsets = packComponentOffsets(bounds, COMPONENT_GAP, aspectRatio);
  const mergedRoutes = new Map<string, Point[]>();
  const mergedNodes: N[] = [];
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    translateComponentLayout(part.nodeIds, part.positions, part.routes, part.edgeIds, offsets[index] ?? { x: 0, y: 0 });
    for (const [id, route] of part.routes) mergedRoutes.set(id, route);
    for (const node of part.nodes) {
      mergedNodes.push({ ...node, position: part.positions.get(node.id) ?? node.position });
    }
  }
  return { nodes: mergedNodes, routes: mergedRoutes };
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

import { spreadStackedRoutes } from './bridges';
import { buildLiveRoutes, type Point, type Rect } from './elkLayout';
import { routeProblems } from './routeRules';

type RoutedEdge = { id: string; source: string; target: string };

/**
 * Routes ready to draw: parallel runs are pulled onto separate lanes, then any arrow that
 * still misses an outline, passes over a box or points away from its target is routed again
 * around the boxes. Arrows that already follow the rules keep their route.
 */
export function settleRoutes(
  edges: readonly RoutedEdge[],
  routes: Map<string, Point[]>,
  rects: Map<string, Rect>,
  fixed: Point[][] = [],
): Map<string, Point[]> {
  const settled = spreadStackedRoutes(routes);
  const follows = (edge: RoutedEdge, route: Point[] | undefined) =>
    !route || routeProblems(route, edge.source, edge.target, rects).length === 0;

  for (const edge of edges) {
    if (follows(edge, settled.get(edge.id))) continue;
    const unspread = routes.get(edge.id);
    if (unspread && follows(edge, unspread)) {
      settled.set(edge.id, unspread);
      continue;
    }
    const siblings = edges.filter((other) => other.id !== edge.id).map((other) => settled.get(other.id)).filter((r): r is Point[] => r !== undefined);
    const rerouted = buildLiveRoutes([edge], rects, [...fixed, ...siblings]).get(edge.id);
    if (rerouted) settled.set(edge.id, rerouted);
  }
  return settled;
}

/** Boxes of nodes that all share one size, keyed by node id. */
export function rectsOfNodes(
  nodes: readonly { id: string; position: Point }[],
  width: number,
  height: number,
): Map<string, Rect> {
  return new Map(nodes.map((n) => [n.id, { x: n.position.x, y: n.position.y, width, height }]));
}

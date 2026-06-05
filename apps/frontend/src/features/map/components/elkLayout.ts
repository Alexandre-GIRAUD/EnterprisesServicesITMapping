import type { ELK as ElkInstance, ElkNode } from 'elkjs/lib/elk-api';
import { Position, type Edge, type Node } from '@xyflow/react';

export type Point = { x: number; y: number };

export type ElkLayoutResult<N extends Node> = {
  nodes: N[];
  routes: Map<string, Point[]>;
};

type Rect = { x: number; y: number; width: number; height: number };

const ALL_SIDES = [Position.Top, Position.Right, Position.Bottom, Position.Left] as const;

function isHorizontalSide(side: Position): boolean {
  return side === Position.Left || side === Position.Right;
}

/** Anchor point at the middle of the given side of a node rect. */
function sideAnchor(rect: Rect, side: Position): Point {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  switch (side) {
    case Position.Top:    return { x: cx,                  y: rect.y };
    case Position.Bottom: return { x: cx,                  y: rect.y + rect.height };
    case Position.Left:   return { x: rect.x,              y: cy };
    case Position.Right:  return { x: rect.x + rect.width, y: cy };
    default:              return { x: cx,                  y: cy };
  }
}

/**
 * Pick the source/target side pair whose border anchors are closest, i.e. the
 * pair that minimizes the link length. Evaluates all 16 side combinations.
 */
function minLengthSides(src: Rect, tgt: Rect): { srcSide: Position; tgtSide: Position } {
  let best = { srcSide: Position.Bottom, tgtSide: Position.Top };
  let bestDist = Infinity;
  for (const s of ALL_SIDES) {
    const sa = sideAnchor(src, s);
    for (const t of ALL_SIDES) {
      const ta = sideAnchor(tgt, t);
      const dist = Math.hypot(ta.x - sa.x, ta.y - sa.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = { srcSide: s, tgtSide: t };
      }
    }
  }
  return best;
}

/** Build a minimal orthogonal polyline between two border anchors. */
function orthogonalRoute(sa: Point, srcSide: Position, ta: Point, tgtSide: Position): Point[] {
  const sHoriz = isHorizontalSide(srcSide);
  const tHoriz = isHorizontalSide(tgtSide);
  if (sHoriz && tHoriz) {
    if (Math.abs(sa.y - ta.y) < 0.5) return [sa, ta];
    const midX = (sa.x + ta.x) / 2;
    return [sa, { x: midX, y: sa.y }, { x: midX, y: ta.y }, ta];
  }
  if (!sHoriz && !tHoriz) {
    if (Math.abs(sa.x - ta.x) < 0.5) return [sa, ta];
    const midY = (sa.y + ta.y) / 2;
    return [sa, { x: sa.x, y: midY }, { x: ta.x, y: midY }, ta];
  }
  // Mixed orientation: single right-angle corner (leaves along the source side).
  return sHoriz ? [sa, { x: ta.x, y: sa.y }, ta] : [sa, { x: sa.x, y: ta.y }, ta];
}

function polylineLength(points: Point[]): number {
  let len = 0;
  for (let i = 0; i < points.length - 1; i++) {
    len += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  }
  return len;
}

/** Axis-aligned segment vs rect overlap test (rect expanded by `margin`). */
function segmentHitsRect(a: Point, b: Point, r: Rect, margin: number): boolean {
  const x0 = r.x - margin;
  const y0 = r.y - margin;
  const x1 = r.x + r.width + margin;
  const y1 = r.y + r.height + margin;
  if (Math.abs(a.y - b.y) < 0.5) {
    if (a.y < y0 || a.y > y1) return false;
    return Math.max(a.x, b.x) >= x0 && Math.min(a.x, b.x) <= x1;
  }
  if (Math.abs(a.x - b.x) < 0.5) {
    if (a.x < x0 || a.x > x1) return false;
    return Math.max(a.y, b.y) >= y0 && Math.min(a.y, b.y) <= y1;
  }
  return false;
}

/** True if no segment of `points` crosses a node other than the two endpoints. */
function routeIsClear(
  points: Point[],
  rects: Map<string, Rect>,
  skipSource: string,
  skipTarget: string
): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    for (const [id, r] of rects) {
      if (id === skipSource || id === skipTarget) continue;
      if (segmentHitsRect(points[i], points[i + 1], r, 4)) return false;
    }
  }
  return true;
}

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

  // Re-anchor each link to the node sides (incl. left/right) that minimize its
  // length, but only when the resulting clean orthogonal route is shorter than
  // ELK's AND does not cross any other node (so ELK's node-avoidance is kept).
  const rectById = new Map<string, Rect>();
  for (const node of nodes) {
    const p = positionById.get(node.id);
    if (!p) continue;
    rectById.set(node.id, {
      x: p.x,
      y: p.y,
      width: node.width ?? nodeWidth,
      height: node.height ?? nodeHeight,
    });
  }
  for (const edge of edges) {
    const srcRect = rectById.get(edge.source);
    const tgtRect = rectById.get(edge.target);
    if (!srcRect || !tgtRect) continue;
    const { srcSide, tgtSide } = minLengthSides(srcRect, tgtRect);
    const candidate = orthogonalRoute(
      sideAnchor(srcRect, srcSide),
      srcSide,
      sideAnchor(tgtRect, tgtSide),
      tgtSide
    );
    const elkRoute = routes.get(edge.id);
    if (elkRoute && polylineLength(elkRoute) <= polylineLength(candidate)) continue;
    if (!routeIsClear(candidate, rectById, edge.source, edge.target)) continue;
    routes.set(edge.id, candidate);
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

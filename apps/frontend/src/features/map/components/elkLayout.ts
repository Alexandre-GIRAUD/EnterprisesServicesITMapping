import type { ELK as ElkInstance, ElkNode } from 'elkjs/lib/elk-api';
import { Position, type Edge, type Node } from '@xyflow/react';
import { alignPositionsForStraighterEdges } from './alignNodes';
import {
  COMPONENT_GAP,
  findConnectedComponents,
  normalizeComponentLayout,
  packComponentOffsets,
  translateComponentLayout,
} from './graphComponents';

export type Point = { x: number; y: number };

export type ElkLayoutResult<N extends Node> = {
  nodes: N[];
  routes: Map<string, Point[]>;
};

export type Rect = { x: number; y: number; width: number; height: number };

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

/** A point on `side` of `rect` whose along-side coordinate equals `offset`. */
function anchorAtOffset(rect: Rect, side: Position, offset: number): Point {
  switch (side) {
    case Position.Top:    return { x: offset,              y: rect.y };
    case Position.Bottom: return { x: offset,              y: rect.y + rect.height };
    case Position.Left:   return { x: rect.x,              y: offset };
    case Position.Right:  return { x: rect.x + rect.width, y: offset };
    default:              return sideAnchor(rect, side);
  }
}

/** Push a border anchor outward along its side by `d` px. */
function outwardStub(p: Point, side: Position, d: number): Point {
  switch (side) {
    case Position.Top:    return { x: p.x,     y: p.y - d };
    case Position.Bottom: return { x: p.x,     y: p.y + d };
    case Position.Left:   return { x: p.x - d, y: p.y };
    case Position.Right:  return { x: p.x + d, y: p.y };
    default:              return p;
  }
}

/** Drop consecutive duplicate and collinear points from an orthogonal polyline. */
function simplifyRoute(points: Point[]): Point[] {
  const dedup: Point[] = [];
  for (const p of points) {
    const last = dedup[dedup.length - 1];
    if (!last || Math.abs(last.x - p.x) > 0.5 || Math.abs(last.y - p.y) > 0.5) dedup.push(p);
  }
  const out: Point[] = [];
  for (let i = 0; i < dedup.length; i++) {
    if (i > 0 && i < dedup.length - 1) {
      const a = dedup[i - 1];
      const b = dedup[i];
      const c = dedup[i + 1];
      const collinear =
        (Math.abs(a.x - b.x) < 0.5 && Math.abs(b.x - c.x) < 0.5) ||
        (Math.abs(a.y - b.y) < 0.5 && Math.abs(b.y - c.y) < 0.5);
      if (collinear) continue;
    }
    out.push(dedup[i]);
  }
  return out;
}

/**
 * Orthogonal route between two border anchors that avoids every node except the
 * two endpoints. Tries the direct route first, then stubbed L-routes, then
 * detours around the bounding box of the blocking nodes. Best-effort: returns
 * the shortest clear candidate, or the direct route if none is clear.
 */
function routeAvoidingNodes(
  sa: Point,
  srcSide: Position,
  ta: Point,
  tgtSide: Position,
  rects: Map<string, Rect>,
  skipSource: string,
  skipTarget: string
): Point[] {
  const direct = orthogonalRoute(sa, srcSide, ta, tgtSide);
  if (routeIsClear(direct, rects, skipSource, skipTarget)) return direct;

  const STUB = 18;
  const ps = outwardStub(sa, srcSide, STUB);
  const pt = outwardStub(ta, tgtSide, STUB);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let hasBlocker = false;
  for (const [id, r] of rects) {
    if (id === skipSource || id === skipTarget) continue;
    for (let i = 0; i < direct.length - 1; i++) {
      if (segmentHitsRect(direct[i], direct[i + 1], r, 4)) {
        hasBlocker = true;
        minX = Math.min(minX, r.x);
        minY = Math.min(minY, r.y);
        maxX = Math.max(maxX, r.x + r.width);
        maxY = Math.max(maxY, r.y + r.height);
        break;
      }
    }
  }

  const candidates: Point[][] = [
    [sa, ps, { x: pt.x, y: ps.y }, pt, ta],
    [sa, ps, { x: ps.x, y: pt.y }, pt, ta],
  ];
  if (hasBlocker) {
    const M = 24;
    const left = minX - M;
    const right = maxX + M;
    const top = minY - M;
    const bottom = maxY + M;
    candidates.push([sa, ps, { x: left, y: ps.y }, { x: left, y: pt.y }, pt, ta]);
    candidates.push([sa, ps, { x: right, y: ps.y }, { x: right, y: pt.y }, pt, ta]);
    candidates.push([sa, ps, { x: ps.x, y: top }, { x: pt.x, y: top }, pt, ta]);
    candidates.push([sa, ps, { x: ps.x, y: bottom }, { x: pt.x, y: bottom }, pt, ta]);
  }

  let best: Point[] | null = null;
  let bestLen = Infinity;
  for (const candidate of candidates) {
    if (!routeIsClear(candidate, rects, skipSource, skipTarget)) continue;
    const len = polylineLength(candidate);
    if (len < bestLen) {
      bestLen = len;
      best = candidate;
    }
  }
  return best ?? direct;
}

/**
 * Recompute node-avoiding orthogonal routes for every edge from the current
 * node rectangles. Anchors are distributed along node sides so no two endpoints
 * coincide. Used live while a node is dragged (the ELK route is then stale).
 */
export function buildLiveRoutes(
  edges: { id: string; source: string; target: string }[],
  rectById: Map<string, Rect>
): Map<string, Point[]> {
  type Plan = { id: string; source: string; target: string; srcSide: Position; tgtSide: Position };
  type Slot = { id: string; role: 'src' | 'tgt'; nodeId: string; side: Position };

  const plans: Plan[] = [];
  for (const e of edges) {
    const srcRect = rectById.get(e.source);
    const tgtRect = rectById.get(e.target);
    if (!srcRect || !tgtRect) continue;
    const { srcSide, tgtSide } = minLengthSides(srcRect, tgtRect);
    plans.push({ id: e.id, source: e.source, target: e.target, srcSide, tgtSide });
  }

  const groups = new Map<string, Slot[]>();
  const addSlot = (slot: Slot) => {
    const key = `${slot.nodeId}|${slot.side}`;
    const list = groups.get(key);
    if (list) list.push(slot);
    else groups.set(key, [slot]);
  };
  for (const plan of plans) {
    addSlot({ id: plan.id, role: 'src', nodeId: plan.source, side: plan.srcSide });
    addSlot({ id: plan.id, role: 'tgt', nodeId: plan.target, side: plan.tgtSide });
  }
  // Quick edge lookup for the sort and alignment detection below.
  const edgeById = new Map(edges.map((e) => [e.id, e]));

  // Alignment detection: when two nodes share the same center X (vertical
  // alignment) or center Y (horizontal alignment) within ALIGN_TOL pixels,
  // the edge between them must exit/enter at the shared coordinate so the path
  // is a perfectly straight line with no bends.
  const ALIGN_TOL = 6;
  const forcedOffset = new Map<string, number>(); // key: `edgeId|role`
  for (const plan of plans) {
    const srcRect = rectById.get(plan.source);
    const tgtRect = rectById.get(plan.target);
    if (!srcRect || !tgtRect) continue;
    const srcCx = srcRect.x + srcRect.width  / 2;
    const srcCy = srcRect.y + srcRect.height / 2;
    const tgtCx = tgtRect.x + tgtRect.width  / 2;
    const tgtCy = tgtRect.y + tgtRect.height / 2;
    const sharedX = (srcCx + tgtCx) / 2;
    const sharedY = (srcCy + tgtCy) / 2;
    // Vertical alignment → Top/Bottom sides → offset is the X coordinate.
    if (!isHorizontalSide(plan.srcSide) && !isHorizontalSide(plan.tgtSide) &&
        Math.abs(srcCx - tgtCx) < ALIGN_TOL) {
      forcedOffset.set(`${plan.id}|src`, sharedX);
      forcedOffset.set(`${plan.id}|tgt`, sharedX);
    }
    // Horizontal alignment → Left/Right sides → offset is the Y coordinate.
    else if (isHorizontalSide(plan.srcSide) && isHorizontalSide(plan.tgtSide) &&
             Math.abs(srcCy - tgtCy) < ALIGN_TOL) {
      forcedOffset.set(`${plan.id}|src`, sharedY);
      forcedOffset.set(`${plan.id}|tgt`, sharedY);
    }
  }

  // Equidistant placement along the full side: N endpoints sit at fractions
  // (i+1)/(N+1) of the side length, so the gap between consecutive endpoints
  // and the margin at each end are all equal to sideLength / (N+1).
  //
  // Slots are ordered by the center coordinate of the *opposite* node along
  // the side's axis (Y for left/right sides, X for top/bottom sides). This
  // assigns the slot closest to the opposite node's position, which minimises
  // total arrow length and avoids crossings between parallel edges.
  //
  // Exception: aligned-node edges get their forced straight-line offset and
  // are excluded from the equidistant distribution of regular slots.
  const slotOffset = new Map<string, number>();
  for (const slots of groups.values()) {
    const { nodeId, side } = slots[0];
    const rect = rectById.get(nodeId);
    if (!rect) continue;
    const horizontalSide = isHorizontalSide(side);
    const spanStart = horizontalSide ? rect.y : rect.x;
    const spanLen = horizontalSide ? rect.height : rect.width;

    // Apply forced (straight-line) offsets immediately.
    for (const slot of slots) {
      const forced = forcedOffset.get(`${slot.id}|${slot.role}`);
      if (forced !== undefined) slotOffset.set(`${slot.id}|${slot.role}`, forced);
    }

    // Distribute the remaining regular slots equidistantly.
    const regular = slots.filter((s) => !forcedOffset.has(`${s.id}|${s.role}`));
    const ordered = [...regular].sort((a, b) => {
      const coordOf = (slot: Slot): number => {
        const edge = edgeById.get(slot.id);
        if (!edge) return 0;
        const otherId = slot.role === 'src' ? edge.target : edge.source;
        const other = rectById.get(otherId);
        if (!other) return 0;
        return horizontalSide
          ? other.y + other.height / 2
          : other.x + other.width / 2;
      };
      return coordOf(a) - coordOf(b);
    });
    const count = ordered.length;
    ordered.forEach((slot, i) =>
      slotOffset.set(`${slot.id}|${slot.role}`, spanStart + ((i + 1) / (count + 1)) * spanLen)
    );
  }

  const routes = new Map<string, Point[]>();
  for (const plan of plans) {
    const srcRect = rectById.get(plan.source);
    const tgtRect = rectById.get(plan.target);
    if (!srcRect || !tgtRect) continue;
    const sOff = slotOffset.get(`${plan.id}|src`);
    const tOff = slotOffset.get(`${plan.id}|tgt`);
    if (sOff === undefined || tOff === undefined) continue;
    const sa = anchorAtOffset(srcRect, plan.srcSide, sOff);
    const ta = anchorAtOffset(tgtRect, plan.tgtSide, tOff);
    const route = routeAvoidingNodes(sa, plan.srcSide, ta, plan.tgtSide, rectById, plan.source, plan.target);
    routes.set(plan.id, simplifyRoute(route));
  }
  return routes;
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
  const nodeIds = nodes.map((n) => n.id);
  const components = findConnectedComponents(
    nodeIds,
    edges.map((e) => ({ source: e.source, target: e.target }))
  );

  if (components.length <= 1) {
    return layoutSingleComponent(nodes, edges, options);
  }

  const {
    nodeWidth = 160,
    nodeHeight = 48,
    aspectRatio,
  } = options;

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const mergedPositions = new Map<string, { x: number; y: number }>();
  const mergedRoutes = new Map<string, Point[]>();
  const mergedNodes: N[] = [];
  const bounds: { width: number; height: number }[] = [];
  const componentMeta: {
    nodeIds: string[];
    edgeIds: string[];
    positions: Map<string, { x: number; y: number }>;
    routes: Map<string, Point[]>;
    nodes: N[];
  }[] = [];

  for (const componentIds of components) {
    const idSet = new Set(componentIds);
    const compNodes = componentIds
      .map((id) => nodeById.get(id))
      .filter((n): n is N => n !== undefined);
    const compEdges = edges.filter((e) => idSet.has(e.source) && idSet.has(e.target));

    const result = await layoutSingleComponent(compNodes, compEdges, options);
    const positions = new Map(result.nodes.map((n) => [n.id, { ...n.position }]));
    const routes = new Map(result.routes);

    const size = normalizeComponentLayout(
      componentIds,
      positions,
      routes,
      compNodes,
      nodeWidth,
      nodeHeight
    );
    bounds.push(size);
    componentMeta.push({
      nodeIds: componentIds,
      edgeIds: compEdges.map((e) => e.id),
      positions,
      routes,
      nodes: result.nodes,
    });
  }

  const offsets = packComponentOffsets(bounds, COMPONENT_GAP, aspectRatio);
  for (let i = 0; i < componentMeta.length; i++) {
    const meta = componentMeta[i];
    const offset = offsets[i] ?? { x: 0, y: 0 };
    translateComponentLayout(meta.nodeIds, meta.positions, meta.routes, meta.edgeIds, offset);

    for (const [id, pos] of meta.positions) mergedPositions.set(id, pos);
    for (const [id, route] of meta.routes) mergedRoutes.set(id, route);
    for (const node of meta.nodes) {
      const pos = meta.positions.get(node.id);
      mergedNodes.push({ ...node, position: pos ?? node.position });
    }
  }

  return { nodes: mergedNodes, routes: mergedRoutes };
}

async function layoutSingleComponent<N extends Node>(
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

  // Snap centers onto neighbor axes when it reduces bends on adjacent edges.
  const aligned = alignPositionsForStraighterEdges(positionById, nodes, edges, {
    nodeWidth,
    nodeHeight,
  });
  for (const [id, pos] of aligned) {
    positionById.set(id, pos);
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

  // Re-route every link with the shared node-avoiding router so that endpoints
  // sharing a node side are spread equidistantly (margin = inter-point gap).
  // The ELK section route is kept only as a fallback when the clean route would
  // cross another node (preserving ELK's node-avoidance in dense cases).
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

  const liveRoutes = buildLiveRoutes(
    edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    rectById
  );
  for (const edge of edges) {
    const live = liveRoutes.get(edge.id);
    if (!live || live.length < 2) continue;
    const elkRoute = routes.get(edge.id);
    if (routeIsClear(live, rectById, edge.source, edge.target) || !elkRoute) {
      routes.set(edge.id, live);
    }
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

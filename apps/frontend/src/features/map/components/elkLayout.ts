import type { ELK as ElkInstance, ElkNode } from 'elkjs/lib/elk-api';
import { Position, type Edge, type Node } from '@xyflow/react';

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

/** Which border of `rect` the point lies on (nearest side). */
function pointSide(p: Point, rect: Rect): Position {
  const dTop    = Math.abs(p.y - rect.y);
  const dBottom = Math.abs(p.y - (rect.y + rect.height));
  const dLeft   = Math.abs(p.x - rect.x);
  const dRight  = Math.abs(p.x - (rect.x + rect.width));
  const min = Math.min(dTop, dBottom, dLeft, dRight);
  if (min === dTop) return Position.Top;
  if (min === dBottom) return Position.Bottom;
  if (min === dLeft) return Position.Left;
  return Position.Right;
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

/** Usable [start, end] range of along-side coordinates (corners trimmed). */
function sideOffsetRange(rect: Rect, side: Position): [number, number] {
  const horizontalSide = isHorizontalSide(side);
  const span = horizontalSide ? rect.height : rect.width;
  const margin = Math.min(14, span / 2 - 1);
  if (horizontalSide) return [rect.y + margin, rect.y + rect.height - margin];
  return [rect.x + margin, rect.x + rect.width - margin];
}

/** The along-side coordinate of a point for the given side. */
function alongOffset(side: Position, p: Point): number {
  return isHorizontalSide(side) ? p.y : p.x;
}

/**
 * Spread `count` endpoints across [start, end] so none coincide with each other
 * or with an already-`occupied` coordinate (kept ≥ `minGap` apart).
 */
function distributeOffsets(
  start: number,
  end: number,
  count: number,
  occupied: number[],
  minGap: number
): number[] {
  if (count <= 0) return [];
  const used = [...occupied];
  const base: number[] = [];
  if (count === 1) base.push((start + end) / 2);
  else for (let i = 0; i < count; i++) base.push(start + ((i + 1) / (count + 1)) * (end - start));

  const result: number[] = [];
  for (const b of base) {
    let chosen = Math.max(start, Math.min(end, b));
    for (let k = 0; k < 24; k++) {
      const candidates = [b + k * minGap, b - k * minGap];
      const free = candidates.find(
        (c) => c >= start && c <= end && !used.some((u) => Math.abs(u - c) < minGap)
      );
      if (free !== undefined) {
        chosen = free;
        break;
      }
    }
    used.push(chosen);
    result.push(chosen);
  }
  return result;
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
  const ENDPOINT_GAP = 12;
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
  const slotOffset = new Map<string, number>();
  for (const slots of groups.values()) {
    const { nodeId, side } = slots[0];
    const rect = rectById.get(nodeId);
    if (!rect) continue;
    const [start, end] = sideOffsetRange(rect, side);
    const ordered = [...slots].sort((a, b) =>
      a.id === b.id ? a.role.localeCompare(b.role) : a.id.localeCompare(b.id)
    );
    const offsets = distributeOffsets(start, end, ordered.length, [], ENDPOINT_GAP);
    ordered.forEach((slot, i) => slotOffset.set(`${slot.id}|${slot.role}`, offsets[i]));
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
  // Endpoints landing on the same node side are spread apart so that no link
  // start ever shares the exact point where another link ends.
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

  const ENDPOINT_GAP = 12;
  type Plan = { id: string; source: string; target: string; srcSide: Position; tgtSide: Position };
  type Slot = { id: string; role: 'src' | 'tgt'; nodeId: string; side: Position };

  const plans: Plan[] = [];
  // Along-side coordinates already taken by ELK-kept routes, per `nodeId|side`.
  const occupied = new Map<string, number[]>();
  const addOccupied = (nodeId: string, side: Position, off: number) => {
    const key = `${nodeId}|${side}`;
    const list = occupied.get(key);
    if (list) list.push(off);
    else occupied.set(key, [off]);
  };

  // Pass 1: decide which edges to re-anchor; register kept endpoints as occupied.
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
    const keepElk =
      (elkRoute && polylineLength(elkRoute) <= polylineLength(candidate)) ||
      !routeIsClear(candidate, rectById, edge.source, edge.target);
    if (keepElk) {
      if (elkRoute && elkRoute.length >= 2) {
        const start = elkRoute[0];
        const end = elkRoute[elkRoute.length - 1];
        const sSide = pointSide(start, srcRect);
        const tSide = pointSide(end, tgtRect);
        addOccupied(edge.source, sSide, alongOffset(sSide, start));
        addOccupied(edge.target, tSide, alongOffset(tSide, end));
      }
      continue;
    }
    plans.push({ id: edge.id, source: edge.source, target: edge.target, srcSide, tgtSide });
  }

  // Pass 2: group re-anchored endpoints per node side and spread them out.
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
  const slotOffset = new Map<string, number>();
  for (const slots of groups.values()) {
    const { nodeId, side } = slots[0];
    const rect = rectById.get(nodeId);
    if (!rect) continue;
    const [start, end] = sideOffsetRange(rect, side);
    const fixed = occupied.get(`${nodeId}|${side}`) ?? [];
    const offsets = distributeOffsets(start, end, slots.length, fixed, ENDPOINT_GAP);
    slots.forEach((slot, i) => slotOffset.set(`${slot.id}|${slot.role}`, offsets[i]));
  }

  // Pass 3: build the final orthogonal route from the distributed anchors.
  for (const plan of plans) {
    const srcRect = rectById.get(plan.source);
    const tgtRect = rectById.get(plan.target);
    if (!srcRect || !tgtRect) continue;
    const sOff = slotOffset.get(`${plan.id}|src`);
    const tOff = slotOffset.get(`${plan.id}|tgt`);
    if (sOff === undefined || tOff === undefined) continue;
    const sa = anchorAtOffset(srcRect, plan.srcSide, sOff);
    const ta = anchorAtOffset(tgtRect, plan.tgtSide, tOff);
    const route = orthogonalRoute(sa, plan.srcSide, ta, plan.tgtSide);
    if (!routeIsClear(route, rectById, plan.source, plan.target)) continue;
    routes.set(plan.id, route);
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

import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  getSmoothStepPath,
  useInternalNode,
  useStore,
  type Edge,
  type EdgeProps,
  type InternalNode,
  type Node,
} from '@xyflow/react';
import { ZOOM_THRESHOLDS } from './graphTheme';
import { buildLiveRoutes, type Point, type Rect } from './elkLayout';
import { buildOrthogonalPath } from './orthogonalPath';
import { computeBridges } from './bridges';

export type OrientedEdgeData = {
  sourceColor: string;
  targetColor: string;
  dashed?: boolean;
  relation?: string;
  bendPoints?: Point[];
  routeStart?: Point;
  routeEnd?: Point;
  jumps?: Point[];
};

export type OrientedEdgeType = Edge<OrientedEdgeData, 'oriented'>;

const CORNER_RADIUS = 8;
const HOP_RADIUS = 5;
const BORDER_TOLERANCE = 14;
/** Approximate half-dimensions of the label pill (flow-coordinate pixels). */
const LABEL_HALF_W = 44;
const LABEL_HALF_H = 10;
/** Step size (px) used when sampling along the arc in stage 2b of safeLabelPos. */
const ARC_SAMPLE_STEP = 10;

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function rectOf(node: InternalNode<Node> | undefined) {
  if (!node) return null;
  const { x, y } = node.internals.positionAbsolute;
  const width  = node.measured?.width  ?? node.width  ?? 0;
  const height = node.measured?.height ?? node.height ?? 0;
  if (!width || !height) return null;
  return { x, y, width, height };
}

function pointRectDistance(p: Point, r: { x: number; y: number; width: number; height: number }) {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.width));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.height));
  return Math.hypot(dx, dy);
}

function endpointValid(point: Point | undefined, node: InternalNode<Node> | undefined): boolean {
  if (!point) return false;
  const rect = rectOf(node);
  if (!rect) return true;
  return pointRectDistance(point, rect) <= BORDER_TOLERANCE;
}

/**
 * Return the point that lies at exactly `targetDist` px along the polyline
 * defined by `points`. Clamps to the last point when `targetDist` exceeds
 * the total arc length.
 */
function pointAtArcDistance(points: Point[], targetDist: number): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return { x: points[0].x, y: points[0].y };
  let accumulated = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (accumulated + segLen >= targetDist) {
      const t = segLen > 0 ? (targetDist - accumulated) / segLen : 0;
      return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
    }
    accumulated += segLen;
  }
  return { x: points[points.length - 1].x, y: points[points.length - 1].y };
}

/**
 * Return the point at exactly 50% of the total arc length of the polyline.
 * This is the true geometric midpoint regardless of how unevenly the bend
 * points are distributed — far more accurate than the index-based midpoint
 * `points[Math.floor(n/2)]` which shifts toward whichever end has shorter
 * segments.
 */
function arcMidpoint(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return { x: points[0].x, y: points[0].y };
  let totalLen = 0;
  for (let i = 0; i < points.length - 1; i++) {
    totalLen += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  }
  return pointAtArcDistance(points, totalLen / 2);
}

// ---------------------------------------------------------------------------
// Side selection for the getSmoothStepPath fallback during drag
// ---------------------------------------------------------------------------

const SIDES = [Position.Top, Position.Right, Position.Bottom, Position.Left] as const;

/** Anchor point at the middle of the given side of a node rect. */
function anchorOf(rect: Rect, side: Position): Point {
  const cx = rect.x + rect.width  / 2;
  const cy = rect.y + rect.height / 2;
  switch (side) {
    case Position.Top:    return { x: cx,                   y: rect.y };
    case Position.Bottom: return { x: cx,                   y: rect.y + rect.height };
    case Position.Left:   return { x: rect.x,               y: cy };
    case Position.Right:  return { x: rect.x + rect.width,  y: cy };
    default:              return { x: cx,                   y: cy };
  }
}

/**
 * Choose the source/target sides whose border anchor points are closest to each
 * other, i.e. the pair that minimizes the arrow length. Evaluates all 16
 * side combinations (4 source × 4 target) and keeps the shortest. Picking the
 * nearest faces naturally makes the arrow exit toward the other node, so the
 * orthogonal path stays short with at most one bend.
 */
function bestSides(
  sourceRect: Rect,
  targetRect: Rect
): { sourcePos: Position; targetPos: Position } {
  let best: { sourcePos: Position; targetPos: Position } = {
    sourcePos: Position.Bottom,
    targetPos: Position.Top,
  };
  let bestDist = Infinity;
  for (const s of SIDES) {
    const sa = anchorOf(sourceRect, s);
    for (const t of SIDES) {
      const ta = anchorOf(targetRect, t);
      const dist = Math.hypot(ta.x - sa.x, ta.y - sa.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = { sourcePos: s, targetPos: t };
      }
    }
  }
  return best;
}

/** Which side `edge` attaches to at `nodeId`, per the live bestSides choice. */
function sideOfEdgeAtNode(
  edge: Edge,
  nodeId: string,
  nodeLookup: Map<string, InternalNode<Node>>
): Position | null {
  const sourceRect = rectOf(nodeLookup.get(edge.source));
  const targetRect = rectOf(nodeLookup.get(edge.target));
  if (!sourceRect || !targetRect) return null;
  const { sourcePos, targetPos } = bestSides(sourceRect, targetRect);
  if (edge.source === nodeId) return sourcePos;
  if (edge.target === nodeId) return targetPos;
  return null;
}

/**
 * Distributed anchor point for `edgeId` on a node side. All edges attaching to
 * the same side of the same node are ordered by id and spread evenly along the
 * side so no two endpoints share the same point — even while dragging.
 */
function distributedAnchor(
  rect: Rect,
  side: Position,
  edgeId: string,
  nodeId: string,
  allEdges: Edge[],
  nodeLookup: Map<string, InternalNode<Node>>
): Point {
  const horizontalSide = side === Position.Left || side === Position.Right;

  // Fast path: if this edge connects two nodes that are aligned (same X center
  // for L/R sides, same Y center for T/B sides), return the straight anchor
  // immediately — no distribution needed, the path must have zero bends.
  const ALIGN_TOL = 6;
  const currentEdge = allEdges.find((e) => e.id === edgeId);
  if (currentEdge) {
    const otherId = currentEdge.source === nodeId ? currentEdge.target : currentEdge.source;
    const otherNode = nodeLookup.get(otherId);
    const otherRect = otherNode ? rectOf(otherNode) : null;
    if (otherRect) {
      const myCx  = rect.x + rect.width  / 2;
      const myCy  = rect.y + rect.height / 2;
      const otCx  = otherRect.x + otherRect.width  / 2;
      const otCy  = otherRect.y + otherRect.height / 2;
      if (!horizontalSide && Math.abs(myCx - otCx) < ALIGN_TOL) {
        // Vertically aligned → anchor at shared X center on Top/Bottom side.
        const sharedX = (myCx + otCx) / 2;
        return {
          x: sharedX,
          y: side === Position.Top ? rect.y : rect.y + rect.height,
        };
      }
      if (horizontalSide && Math.abs(myCy - otCy) < ALIGN_TOL) {
        // Horizontally aligned → anchor at shared Y center on Left/Right side.
        const sharedY = (myCy + otCy) / 2;
        return {
          x: side === Position.Left ? rect.x : rect.x + rect.width,
          y: sharedY,
        };
      }
    }
  }

  // Sort peers by the center coordinate of their opposite node along the side's
  // axis so each slot is assigned to the edge whose destination is spatially
  // aligned with it — minimises total arrow length and prevents crossings.
  const peers = allEdges
    .filter((e) => sideOfEdgeAtNode(e, nodeId, nodeLookup) === side)
    .sort((a, b) => {
      const coordOf = (e: Edge): number => {
        const otherId = e.source === nodeId ? e.target : e.source;
        const otherNode = nodeLookup.get(otherId);
        const r = otherNode ? rectOf(otherNode) : null;
        if (!r) return 0;
        return horizontalSide ? r.y + r.height / 2 : r.x + r.width / 2;
      };
      return coordOf(a) - coordOf(b);
    })
    .map((e) => e.id);
  const count = peers.length || 1;
  const index = Math.max(0, peers.indexOf(edgeId));
  // Equidistant along the full side: gap == end margin == sideLength / (N+1).
  const frac = (index + 1) / (count + 1);
  if (horizontalSide) {
    return {
      x: side === Position.Left ? rect.x : rect.x + rect.width,
      y: rect.y + frac * rect.height,
    };
  }
  return {
    x: rect.x + frac * rect.width,
    y: side === Position.Top ? rect.y : rect.y + rect.height,
  };
}

// ---------------------------------------------------------------------------
// Label placement: node-overlap avoidance
// ---------------------------------------------------------------------------

/**
 * Find a label position on the polyline that does not visually overlap any
 * node bounding box.
 *
 * Stages (executed in order, first clear position wins):
 *  1. Initial position (true arc midpoint) — return immediately if clear.
 *  2. Segment midpoints sorted by segment length (longest = most open space).
 *  2b. Dense arc sampling: walk outward from the midpoint in ±ARC_SAMPLE_STEP
 *      increments along the actual polyline. Catches gaps that lie between
 *      bend points but are missed by the segment-midpoint scan (e.g. when a
 *      node covers the midpoint of every segment but a clear stretch exists
 *      25 px from center).
 *  3. Perpendicular offsets (±20, ±40, ±60, ±80 px perpendicular to the
 *     chord direction) — essential for 2-point straight-line fallback paths
 *     that have only one segment midpoint.
 *  4. Last resort: return initial position unchanged.
 */
function safeLabelPos(
  points: Point[],
  nodeLookup: Map<string, InternalNode<Node>>,
  skipIds: [string, string],
  initialX: number,
  initialY: number
): { x: number; y: number } {
  const skip = new Set<string>(skipIds);

  function overlapsNode(x: number, y: number): boolean {
    for (const [id, node] of nodeLookup) {
      if (skip.has(id)) continue;
      const pos = node.internals?.positionAbsolute;
      if (!pos) continue;
      const w = node.measured?.width  ?? node.width  ?? 0;
      const h = node.measured?.height ?? node.height ?? 0;
      if (!w || !h) continue;
      if (
        x + LABEL_HALF_W > pos.x &&
        x - LABEL_HALF_W < pos.x + w &&
        y + LABEL_HALF_H > pos.y &&
        y - LABEL_HALF_H < pos.y + h
      ) return true;
    }
    return false;
  }

  // Stage 1: initial position already clear.
  if (!overlapsNode(initialX, initialY)) return { x: initialX, y: initialY };

  if (points.length < 2) return { x: initialX, y: initialY };

  // Stage 2: every segment midpoint, longest first.
  const candidates: { x: number; y: number; len: number }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    candidates.push({
      x:   (p1.x + p2.x) / 2,
      y:   (p1.y + p2.y) / 2,
      len: Math.hypot(p2.x - p1.x, p2.y - p1.y),
    });
  }
  candidates.sort((a, b) => b.len - a.len);
  for (const c of candidates) {
    if (!overlapsNode(c.x, c.y)) return { x: c.x, y: c.y };
  }

  // Stage 2b: dense arc sampling outward from the true midpoint.
  // Walk in both directions simultaneously (forward then backward per step)
  // so we always prefer the position closest to the visual center of the edge.
  const totalLen = candidates.reduce((s, c) => s + c.len, 0);
  if (totalLen > 0) {
    const halfLen = totalLen / 2;
    for (let d = ARC_SAMPLE_STEP; d <= totalLen / 2 + ARC_SAMPLE_STEP; d += ARC_SAMPLE_STEP) {
      const fwd = pointAtArcDistance(points, Math.min(halfLen + d, totalLen));
      if (!overlapsNode(fwd.x, fwd.y)) return { x: fwd.x, y: fwd.y };
      const distBack = halfLen - d;
      if (distBack >= 0) {
        const bck = pointAtArcDistance(points, distBack);
        if (!overlapsNode(bck.x, bck.y)) return { x: bck.x, y: bck.y };
      }
    }
  }

  // Stage 3: perpendicular offsets from the initial position — works for
  // 2-point fallback paths where only one segment midpoint exists.
  const edgeDx = points[points.length - 1].x - points[0].x;
  const edgeDy = points[points.length - 1].y - points[0].y;
  const edgeLen = Math.hypot(edgeDx, edgeDy);
  if (edgeLen > 0) {
    const perpX = -edgeDy / edgeLen;
    const perpY =  edgeDx / edgeLen;
    for (const offset of [20, -20, 40, -40, 60, -60, 80, -80]) {
      const cx = initialX + perpX * offset;
      const cy = initialY + perpY * offset;
      if (!overlapsNode(cx, cy)) return { x: cx, y: cy };
    }
  }

  // Stage 4: nothing worked — return the initial position unchanged.
  return { x: initialX, y: initialY };
}

// ---------------------------------------------------------------------------
// Live (drag-time) routing: node-avoiding routes + line-jump bridges
// ---------------------------------------------------------------------------

/** Current node rectangles keyed by id, from the live React Flow store. */
function buildRectById(nodeLookup: Map<string, InternalNode<Node>>): Map<string, Rect> {
  const rects = new Map<string, Rect>();
  for (const [id, node] of nodeLookup) {
    const rect = rectOf(node);
    if (rect) rects.set(id, rect);
  }
  return rects;
}

/** True once any edge's stored ELK route no longer matches current positions. */
function anyRouteStale(allEdges: Edge[], rectById: Map<string, Rect>): boolean {
  for (const edge of allEdges) {
    const data = edge.data as OrientedEdgeData | undefined;
    if (!data?.routeStart || !data?.routeEnd) continue;
    const srcRect = rectById.get(edge.source);
    const tgtRect = rectById.get(edge.target);
    if (!srcRect || !tgtRect) continue;
    if (
      pointRectDistance(data.routeStart, srcRect) > BORDER_TOLERANCE ||
      pointRectDistance(data.routeEnd, tgtRect) > BORDER_TOLERANCE
    ) {
      return true;
    }
  }
  return false;
}

type LiveBundle = { routes: Map<string, Point[]>; jumps: Map<string, Point[]> };
let liveCache: { key: string; bundle: LiveBundle } | null = null;

/** Deterministic key over edge ids + node geometry so all edges share one compute. */
function liveKey(allEdges: Edge[], rectById: Map<string, Rect>): string {
  const edgePart = allEdges
    .map((e) => `${e.id}:${e.source}>${e.target}`)
    .sort()
    .join(',');
  const nodePart = [...rectById.entries()]
    .map(([id, r]) => `${id}:${Math.round(r.x)},${Math.round(r.y)},${r.width},${r.height}`)
    .sort()
    .join(',');
  return `${edgePart}|${nodePart}`;
}

/** Memoized live routes + bridges, recomputed only when geometry changes. */
function getLiveBundle(allEdges: Edge[], rectById: Map<string, Rect>): LiveBundle {
  const key = liveKey(allEdges, rectById);
  if (liveCache && liveCache.key === key) return liveCache.bundle;
  const routes = buildLiveRoutes(
    allEdges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    rectById
  );
  const jumps = computeBridges(routes);
  const bundle: LiveBundle = { routes, jumps };
  liveCache = { key, bundle };
  return bundle;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OrientedEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  markerEnd,
  data,
  label,
}: EdgeProps<OrientedEdgeType>) {
  const zoom = useStore((s) => s.transform[2]);

  // React Flow mutates nodeLookup in place, so useStore on the Map reference
  // never detects changes (Object.is returns true for the same Map). This scalar
  // hash changes whenever any node moves, guaranteeing a re-render of every edge
  // (including edges whose own source/target did not move) so safeLabelPos always
  // runs with fresh positions for ALL nodes.
  useStore((s) => {
    let hash = 0;
    for (const [, n] of s.nodeLookup) {
      const p = n.internals?.positionAbsolute;
      if (p) hash += p.x + p.y;
    }
    return hash;
  });
  const nodeLookup = useStore((s) => s.nodeLookup) as Map<string, InternalNode<Node>>;
  const allEdges = useStore((s) => s.edges) as Edge[];

  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  // While any node is being dragged the stored ELK routes are stale: recompute
  // node-avoiding routes + bridges for the whole graph so arrows never cross
  // over nodes and hop over each other at crossings.
  const rectById = buildRectById(nodeLookup);
  const liveActive = anyRouteStale(allEdges, rectById);
  const liveBundle = liveActive ? getLiveBundle(allEdges, rectById) : null;
  const liveRoute = liveBundle?.routes.get(id);

  const routeUsable =
    !liveActive &&
    Boolean(data?.bendPoints) &&
    endpointValid(data?.routeStart, sourceNode) &&
    endpointValid(data?.routeEnd, targetNode);

  const srcRect = rectOf(sourceNode);
  const tgtRect = rectOf(targetNode);
  const liveSides =
    !routeUsable && srcRect && tgtRect ? bestSides(srcRect, tgtRect) : null;

  const liveSourcePos = liveSides?.sourcePos ?? sourcePosition;
  const liveTargetPos = liveSides?.targetPos ?? targetPosition;

  let liveSourceX = sourceX;
  let liveSourceY = sourceY;
  let liveTargetX = targetX;
  let liveTargetY = targetY;

  if (liveSides && srcRect && tgtRect) {
    const sa = distributedAnchor(srcRect, liveSides.sourcePos, id, source, allEdges, nodeLookup);
    const ta = distributedAnchor(tgtRect, liveSides.targetPos, id, target, allEdges, nodeLookup);
    liveSourceX = sa.x;
    liveSourceY = sa.y;
    liveTargetX = ta.x;
    liveTargetY = ta.y;
  }

  const [fallbackPath] = getSmoothStepPath({
    sourceX: liveSourceX,
    sourceY: liveSourceY,
    sourcePosition: liveSourcePos,
    targetX: liveTargetX,
    targetY: liveTargetY,
    targetPosition: liveTargetPos,
    borderRadius: CORNER_RADIUS,
  });

  let edgePath = fallbackPath;
  let gradientFrom = { x: liveSourceX, y: liveSourceY };
  let gradientTo   = { x: liveTargetX, y: liveTargetY };
  // pathPoints for the fallback: straight line between the live endpoints.
  // arcMidpoint of 2 points = exact midpoint of the segment — consistent with
  // the ELK case and avoids relying on getSmoothStepPath's internal heuristic.
  let pathPoints: Point[] = [
    { x: liveSourceX, y: liveSourceY },
    { x: liveTargetX, y: liveTargetY },
  ];

  if (liveActive && liveRoute && liveRoute.length >= 2) {
    pathPoints   = liveRoute;
    edgePath     = buildOrthogonalPath(pathPoints, CORNER_RADIUS, liveBundle?.jumps.get(id) ?? [], HOP_RADIUS);
    gradientFrom = liveRoute[0];
    gradientTo   = liveRoute[liveRoute.length - 1];
  } else if (routeUsable && data?.routeStart && data?.routeEnd) {
    pathPoints  = [data.routeStart, ...(data.bendPoints ?? []), data.routeEnd];
    edgePath    = buildOrthogonalPath(pathPoints, CORNER_RADIUS, data.jumps ?? [], HOP_RADIUS);
    gradientFrom = data.routeStart;
    gradientTo   = data.routeEnd;
  }

  // True geometric midpoint (50% of total arc length) — independent of the
  // number or distribution of bend points.
  const mid = arcMidpoint(pathPoints);
  const safeLabel = safeLabelPos(pathPoints, nodeLookup, [source, target], mid.x, mid.y);
  const labelX = safeLabel.x;
  const labelY = safeLabel.y;

  const sourceColor = data?.sourceColor ?? '#64748b';
  const targetColor = data?.targetColor ?? '#94a3b8';
  const gradientId  = `oriented-edge-gradient-${id}`;
  const showLabel   = Boolean(label) && zoom >= ZOOM_THRESHOLDS.secondaryDetail;

  return (
    <>
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1={gradientFrom.x}
          y1={gradientFrom.y}
          x2={gradientTo.x}
          y2={gradientTo.y}
        >
          <stop offset="0%" stopColor={sourceColor} />
          <stop offset="100%" stopColor={targetColor} />
        </linearGradient>
      </defs>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: `url(#${gradientId})`,
          strokeWidth: 1.75,
          opacity: 0.95,
          ...(data?.dashed ? { strokeDasharray: '6 4' } : {}),
        }}
      />
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            className="oriented-edge-label nodrag nopan"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

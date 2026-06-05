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
import type { Point } from './elkLayout';
import { buildOrthogonalPath } from './orthogonalPath';

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

/**
 * Pick the handle side that faces the other node directly so the fallback path
 * exits from the correct face with at most one 90-degree bend.
 */
function bestSides(
  sourceRect: { x: number; y: number; width: number; height: number },
  targetRect: { x: number; y: number; width: number; height: number }
): { sourcePos: Position; targetPos: Position } {
  const srcCx = sourceRect.x + sourceRect.width  / 2;
  const srcCy = sourceRect.y + sourceRect.height / 2;
  const tgtCx = targetRect.x + targetRect.width  / 2;
  const tgtCy = targetRect.y + targetRect.height / 2;
  const dx = tgtCx - srcCx;
  const dy = tgtCy - srcCy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourcePos: Position.Right, targetPos: Position.Left }
      : { sourcePos: Position.Left,  targetPos: Position.Right };
  }
  return dy >= 0
    ? { sourcePos: Position.Bottom, targetPos: Position.Top }
    : { sourcePos: Position.Top,    targetPos: Position.Bottom };
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

  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  const routeUsable =
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
    const srcMidX = srcRect.x + srcRect.width  / 2;
    const srcMidY = srcRect.y + srcRect.height / 2;
    const tgtMidX = tgtRect.x + tgtRect.width  / 2;
    const tgtMidY = tgtRect.y + tgtRect.height / 2;
    switch (liveSides.sourcePos) {
      case Position.Right:  liveSourceX = srcRect.x + srcRect.width; liveSourceY = srcMidY; break;
      case Position.Left:   liveSourceX = srcRect.x;                 liveSourceY = srcMidY; break;
      case Position.Bottom: liveSourceX = srcMidX; liveSourceY = srcRect.y + srcRect.height; break;
      case Position.Top:    liveSourceX = srcMidX; liveSourceY = srcRect.y; break;
    }
    switch (liveSides.targetPos) {
      case Position.Left:   liveTargetX = tgtRect.x;                 liveTargetY = tgtMidY; break;
      case Position.Right:  liveTargetX = tgtRect.x + tgtRect.width; liveTargetY = tgtMidY; break;
      case Position.Top:    liveTargetX = tgtMidX; liveTargetY = tgtRect.y; break;
      case Position.Bottom: liveTargetX = tgtMidX; liveTargetY = tgtRect.y + tgtRect.height; break;
    }
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

  if (routeUsable && data?.routeStart && data?.routeEnd) {
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

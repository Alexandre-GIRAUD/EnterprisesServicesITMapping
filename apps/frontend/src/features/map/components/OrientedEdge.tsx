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
const LABEL_HALF_W = 44;
const LABEL_HALF_H = 10;

function rectOf(node: InternalNode<Node> | undefined) {
  if (!node) return null;
  const { x, y } = node.internals.positionAbsolute;
  const width = node.measured?.width ?? node.width ?? 0;
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
 * Pick the handle side that faces the other node directly. Guarantees at most
 * one 90-degree bend in the fallback path and prevents the line from cutting
 * across any node face.
 */
function bestSides(
  sourceRect: { x: number; y: number; width: number; height: number },
  targetRect: { x: number; y: number; width: number; height: number }
): { sourcePos: Position; targetPos: Position } {
  const srcCx = sourceRect.x + sourceRect.width / 2;
  const srcCy = sourceRect.y + sourceRect.height / 2;
  const tgtCx = targetRect.x + targetRect.width / 2;
  const tgtCy = targetRect.y + targetRect.height / 2;
  const dx = tgtCx - srcCx;
  const dy = tgtCy - srcCy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourcePos: Position.Right, targetPos: Position.Left }
      : { sourcePos: Position.Left, targetPos: Position.Right };
  }
  return dy >= 0
    ? { sourcePos: Position.Bottom, targetPos: Position.Top }
    : { sourcePos: Position.Top, targetPos: Position.Bottom };
}

/**
 * Find a label position that does not overlap any node bounding box. Tries
 * segment midpoints sorted by length (longest first = most open space).
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
      const w = node.measured?.width ?? node.width ?? 0;
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

  if (!overlapsNode(initialX, initialY)) return { x: initialX, y: initialY };
  if (points.length < 2) return { x: initialX, y: initialY };

  const candidates = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    candidates.push({
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
      len: Math.hypot(p2.x - p1.x, p2.y - p1.y),
    });
  }
  candidates.sort((a, b) => b.len - a.len);

  for (const c of candidates) {
    if (!overlapsNode(c.x, c.y)) return { x: c.x, y: c.y };
  }
  return { x: initialX, y: initialY };
}

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
    const srcMidX = srcRect.x + srcRect.width / 2;
    const srcMidY = srcRect.y + srcRect.height / 2;
    const tgtMidX = tgtRect.x + tgtRect.width / 2;
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

  const [fallbackPath, fbLabelX, fbLabelY] = getSmoothStepPath({
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
  let gradientTo = { x: liveTargetX, y: liveTargetY };
  let labelX = fbLabelX;
  let labelY = fbLabelY;
  let pathPoints: Point[] = [
    { x: liveSourceX, y: liveSourceY },
    { x: liveTargetX, y: liveTargetY },
  ];

  if (routeUsable && data?.routeStart && data?.routeEnd) {
    pathPoints = [data.routeStart, ...(data.bendPoints ?? []), data.routeEnd];
    edgePath = buildOrthogonalPath(pathPoints, CORNER_RADIUS, data.jumps ?? [], HOP_RADIUS);
    gradientFrom = data.routeStart;
    gradientTo = data.routeEnd;
    const mid = pathPoints[Math.floor(pathPoints.length / 2)];
    labelX = mid.x;
    labelY = mid.y;
  }

  const safeLabel = safeLabelPos(pathPoints, nodeLookup, [source, target], labelX, labelY);
  labelX = safeLabel.x;
  labelY = safeLabel.y;

  const sourceColor = data?.sourceColor ?? '#64748b';
  const targetColor = data?.targetColor ?? '#94a3b8';
  const gradientId = `oriented-edge-gradient-${id}`;
  const showLabel = Boolean(label) && zoom >= ZOOM_THRESHOLDS.secondaryDetail;

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

import {
  BaseEdge,
  EdgeLabelRenderer,
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
  /** Source-node identity color (gradient start). */
  sourceColor: string;
  /** Target-node identity color (gradient end + arrowhead). */
  targetColor: string;
  /** Dashed stroke for composition-style relations. */
  dashed?: boolean;
  /** Relation label (e.g. DEPENDS_ON). */
  relation?: string;
  /** ELK interior bend points (flow coords) for orthogonal routing. */
  bendPoints?: Point[];
  /** ELK routed endpoints, used to detect drag drift and fall back. */
  routeStart?: Point;
  routeEnd?: Point;
  /** Line-jump crossings on this edge's horizontal runs. */
  jumps?: Point[];
};

export type OrientedEdgeType = Edge<OrientedEdgeData, 'oriented'>;

const CORNER_RADIUS = 8;
const HOP_RADIUS = 5;
/** How far a routed endpoint may sit from a node's border before we re-route. */
const BORDER_TOLERANCE = 14;

/** Axis-aligned rect (flow coords) for a node, or null if not measured yet. */
function rectOf(node: InternalNode<Node> | undefined) {
  if (!node) return null;
  const { x, y } = node.internals.positionAbsolute;
  const width = node.measured?.width ?? node.width ?? 0;
  const height = node.measured?.height ?? node.height ?? 0;
  if (!width || !height) return null;
  return { x, y, width, height };
}

/** Distance from a point to a rect (0 when on/inside the border). */
function pointRectDistance(p: Point, r: { x: number; y: number; width: number; height: number }) {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.width));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.height));
  return Math.hypot(dx, dy);
}

/** A routed endpoint is valid while it still lies on its node's border. */
function endpointValid(point: Point | undefined, node: InternalNode<Node> | undefined): boolean {
  if (!point) return false;
  const rect = rectOf(node);
  if (!rect) return true; // dimensions unknown on first paint: trust the route
  return pointRectDistance(point, rect) <= BORDER_TOLERANCE;
}

/**
 * Orthogonal (Manhattan) edge with rounded bends, line-jump bridges and a
 * directional color gradient (source color → target color).
 *
 * When ELK supplies a routed poly-line, the path is drawn through its
 * node-avoiding bends with {@link buildOrthogonalPath}, anchored at the exact
 * border points ELK chose — so links can leave/enter via any of the 4 sides and
 * the arrowhead lands precisely on that boundary. If either endpoint's node is
 * dragged off its routed border, the edge gracefully falls back to
 * {@link getSmoothStepPath} so it keeps tracking the node live.
 */
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
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  const [fallbackPath, fbLabelX, fbLabelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: CORNER_RADIUS,
  });

  const routeUsable =
    Boolean(data?.bendPoints) &&
    endpointValid(data?.routeStart, sourceNode) &&
    endpointValid(data?.routeEnd, targetNode);

  let edgePath = fallbackPath;
  let gradientFrom = { x: sourceX, y: sourceY };
  let gradientTo = { x: targetX, y: targetY };
  let labelX = fbLabelX;
  let labelY = fbLabelY;

  if (routeUsable && data?.routeStart && data?.routeEnd) {
    const points = [data.routeStart, ...(data.bendPoints ?? []), data.routeEnd];
    edgePath = buildOrthogonalPath(points, CORNER_RADIUS, data.jumps ?? [], HOP_RADIUS);
    gradientFrom = data.routeStart;
    gradientTo = data.routeEnd;
    const mid = points[Math.floor(points.length / 2)];
    labelX = mid.x;
    labelY = mid.y;
  }

  const sourceColor = data?.sourceColor ?? '#64748b';
  const targetColor = data?.targetColor ?? '#94a3b8';
  const gradientId = `oriented-edge-gradient-${id}`;
  const showLabel = Boolean(label) && zoom >= ZOOM_THRESHOLDS.secondaryDetail;

  return (
    <>
      <defs>
        {/* userSpaceOnUse: gradient axis runs along the real source→target vector. */}
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

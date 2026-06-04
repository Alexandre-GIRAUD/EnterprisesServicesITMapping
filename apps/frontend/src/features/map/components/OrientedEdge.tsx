import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useStore,
  type Edge,
  type EdgeProps,
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
/** Beyond this drift between live handle and ELK endpoint, drop the static route. */
const ROUTE_DRIFT_TOLERANCE = 24;

function drifted(live: Point, routed: Point | undefined): boolean {
  if (!routed) return false;
  return Math.hypot(live.x - routed.x, live.y - routed.y) > ROUTE_DRIFT_TOLERANCE;
}

/**
 * Orthogonal (Manhattan) edge with rounded bends, line-jump bridges and a
 * directional color gradient (source color → target color).
 *
 * When ELK supplies a routed poly-line (`data.bendPoints`), the path is drawn
 * through those node-avoiding bends with {@link buildOrthogonalPath}; the
 * endpoints use the live handle positions so the edge always meets the center
 * of the node's bounding-box edge and the arrowhead lands on that boundary.
 * If a node is dragged far from its routed endpoint, the edge gracefully falls
 * back to {@link getSmoothStepPath} so it keeps tracking the node.
 */
export function OrientedEdge({
  id,
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
  const [fallbackPath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: CORNER_RADIUS,
  });

  const live = { source: { x: sourceX, y: sourceY }, target: { x: targetX, y: targetY } };
  const hasRoute = Boolean(data?.bendPoints);
  const routeUsable =
    hasRoute &&
    !drifted(live.source, data?.routeStart) &&
    !drifted(live.target, data?.routeEnd);

  const edgePath = routeUsable
    ? buildOrthogonalPath(
        [live.source, ...(data?.bendPoints ?? []), live.target],
        CORNER_RADIUS,
        data?.jumps ?? [],
        HOP_RADIUS
      )
    : fallbackPath;

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
          x1={sourceX}
          y1={sourceY}
          x2={targetX}
          y2={targetY}
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

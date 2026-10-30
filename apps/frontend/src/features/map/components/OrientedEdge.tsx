import { useState, type KeyboardEvent, type MouseEvent } from 'react';
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
import type { StoredAttribute } from '@/types/api';
import {
  APPLICATION_TITLE_FONT_SIZE_PX,
  buildFlowLabelMapTransform,
  isFlowLabelVisible,
} from './flowLabel';
import { buildLiveRoutes, type Point, type Rect } from './elkLayout';
import { buildOrthogonalPath } from './orthogonalPath';
import { BORDER_TOLERANCE, findStaleEdgeIds, pointRectDistance } from './staleEdges';
import {
  arcMidpoint,
  estimateLabelSize,
  placeEdgeLabels,
  type LabelRequest,
} from './labelPlacement';
import { computeBridges, spreadStackedRoutes } from './bridges';
import { notifyEdgeDetailsOpen } from '../utils/edgeDetailsSelection';

export type OrientedEdgeData = {
  sourceColor: string;
  targetColor: string;
  /** Optional distinct color for the edge label pill (falls back to sourceColor). */
  labelColor?: string;
  /** When true, hide business edge labels (indirect + control still shown). */
  hideEdgeLabels?: boolean;
  dashed?: boolean;
  relation?: string;
  /** Label shown on the link (data type when available). */
  dataLabel?: string;
  /** Sandbox display-only label (never written to Neo4j). */
  displayLabel?: string;
  /** When set, double-click edits the displayed label only. */
  onDisplayLabelChange?: (label: string) => void;
  /** Open connection details drawer (edge stroke / label click). */
  onSelect?: () => void;
  /** Raw Neo4j `r.data` key used for edge labels. */
  dataKey?: string | null;
  /** Edge property key currently driving stroke color. */
  colorPropertyKey?: string;
  /** Resolved value for {@link colorPropertyKey}. */
  colorValue?: string | null;
  /** Colorable relationship properties from the API. */
  properties?: Record<string, StoredAttribute>;
  /** True for collapse shortcuts that bridge one or more hidden applications. */
  indirect?: boolean;
  /** Application ids restored when the expand control on this edge is clicked. */
  hiddenNodeIds?: string[];
  /** Expand hidden applications represented by this indirect edge. */
  onExpand?: () => void;
  /** Highlight this edge (GraphCanvas hover). */
  hovered?: boolean;
  bendPoints?: Point[];
  routeStart?: Point;
  routeEnd?: Point;
  jumps?: Point[];
};

export type OrientedEdgeType = Edge<OrientedEdgeData, 'oriented'>;

const CORNER_RADIUS = 8;
const HOP_RADIUS = 5;
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

function endpointValid(point: Point | undefined, node: InternalNode<Node> | undefined): boolean {
  if (!point) return false;
  const rect = rectOf(node);
  if (!rect) return true;
  return pointRectDistance(point, rect) <= BORDER_TOLERANCE;
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
 * the same side of the same node are spread along that side so no two endpoints
 * share an anchor point — several arrows may still touch the same node side.
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

  // Sole edge on this side + aligned nodes → straight centre tip (unique by definition).
  const ALIGN_TOL = 6;
  const currentEdge = allEdges.find((e) => e.id === edgeId);
  if (count <= 1 && currentEdge) {
    const otherId = currentEdge.source === nodeId ? currentEdge.target : currentEdge.source;
    const otherNode = nodeLookup.get(otherId);
    const otherRect = otherNode ? rectOf(otherNode) : null;
    if (otherRect) {
      const myCx  = rect.x + rect.width  / 2;
      const myCy  = rect.y + rect.height / 2;
      const otCx  = otherRect.x + otherRect.width  / 2;
      const otCy  = otherRect.y + otherRect.height / 2;
      if (!horizontalSide && Math.abs(myCx - otCx) < ALIGN_TOL) {
        const sharedX = (myCx + otCx) / 2;
        return {
          x: sharedX,
          y: side === Position.Top ? rect.y : rect.y + rect.height,
        };
      }
      if (horizontalSide && Math.abs(myCy - otCy) < ALIGN_TOL) {
        const sharedY = (myCy + otCy) / 2;
        return {
          x: side === Position.Left ? rect.x : rect.x + rect.width,
          y: sharedY,
        };
      }
    }
  }

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
// Label placement: shared by every edge so labels never overlap
// ---------------------------------------------------------------------------

/** Route an edge is drawn along, as far as it is known outside the edge component. */
function routePointsOf(
  edge: Edge,
  rectById: Map<string, Rect>,
  liveRoutes: Map<string, Point[]> | null
): Point[] | null {
  const data = edge.data as OrientedEdgeData | undefined;
  const live = liveRoutes?.get(edge.id);
  if (live && live.length >= 2) return live;
  if (data?.routeStart && data?.routeEnd) {
    return [data.routeStart, ...(data.bendPoints ?? []), data.routeEnd];
  }
  const srcRect = rectById.get(edge.source);
  const tgtRect = rectById.get(edge.target);
  if (!srcRect || !tgtRect) return null;
  const sides = bestSides(srcRect, tgtRect);
  return [anchorOf(srcRect, sides.sourcePos), anchorOf(tgtRect, sides.targetPos)];
}

function buildLabelRequests(
  allEdges: Edge[],
  rectById: Map<string, Rect>,
  liveRoutes: Map<string, Point[]> | null
): LabelRequest[] {
  const requests: LabelRequest[] = [];
  for (const edge of allEdges) {
    const data = edge.data as OrientedEdgeData | undefined;
    const text = data?.displayLabel !== undefined ? data.displayLabel : String(edge.label ?? '');
    const visible = isFlowLabelVisible({
      text,
      shouldHideLabels: Boolean(data?.hideEdgeLabels),
      isIndirect: Boolean(data?.indirect),
      isEditing: false,
    });
    const points = visible ? routePointsOf(edge, rectById, liveRoutes) : null;
    if (!points) continue;
    requests.push({
      id: edge.id,
      points,
      sourceId: edge.source,
      targetId: edge.target,
      ...estimateLabelSize(text),
    });
  }
  return requests;
}

let labelCache: { key: string; positions: Map<string, Point> } | null = null;

/** Memoized label positions for all edges, recomputed only when routes or nodes change. */
function getLabelPositions(
  allEdges: Edge[],
  rectById: Map<string, Rect>,
  liveRoutes: Map<string, Point[]> | null
): Map<string, Point> {
  const requests = buildLabelRequests(allEdges, rectById, liveRoutes);
  const key = [
    requests
      .map((r) => `${r.id}:${r.width}:${r.points.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(';')}`)
      .sort()
      .join('|'),
    liveKey([], rectById),
  ].join('#');
  if (labelCache && labelCache.key === key) return labelCache.positions;
  const obstacles = [...rectById.entries()].map(([id, rect]) => ({ id, ...rect }));
  const positions = placeEdgeLabels(requests, obstacles);
  labelCache = { key, positions };
  return positions;
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

/**
 * Memoized routes + bridges for the stale arrows only; every other arrow keeps its stored
 * route and only takes part in the bridge computation as a fixed obstacle.
 */
function getLiveBundle(allEdges: Edge[], rectById: Map<string, Rect>, staleIds: Set<string>): LiveBundle {
  const key = `${liveKey(allEdges, rectById)}|${[...staleIds].sort().join(',')}`;
  if (liveCache && liveCache.key === key) return liveCache.bundle;
  const routes = spreadStackedRoutes(buildLiveRoutes(
    allEdges
      .filter((e) => staleIds.has(e.id))
      .map((e) => ({ id: e.id, source: e.source, target: e.target })),
    rectById
  ));
  const allRoutes = new Map(routes);
  for (const edge of allEdges) {
    const data = edge.data as OrientedEdgeData | undefined;
    if (!staleIds.has(edge.id) && data?.routeStart && data?.routeEnd) {
      allRoutes.set(edge.id, [data.routeStart, ...(data.bendPoints ?? []), data.routeEnd]);
    }
  }
  const jumps = computeBridges(allRoutes);
  const bundle: LiveBundle = { routes, jumps };
  liveCache = { key, bundle };
  return bundle;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Screen-pixel hit width; divided by the zoom so it stays clickable when zoomed out. */
const EDGE_HIT_STROKE = 24;

/** Resting edge thickness in flow units. */
const REST_STROKE = 1.75;

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
  selected,
}: EdgeProps<OrientedEdgeType>) {
  const zoom = useStore((s) => s.transform[2]);

  // React Flow mutates nodeLookup in place, so useStore on the Map reference
  // never detects changes (Object.is returns true for the same Map). This scalar
  // hash changes whenever any node moves, guaranteeing a re-render of every edge
  // (including edges whose own source/target did not move) so label placement always
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

  // Only the arrows attached to a moved or resized box have a stale ELK route: those
  // get node-avoiding routes + bridges, every other arrow keeps its stored route.
  const rectById = buildRectById(nodeLookup);
  const staleIds = findStaleEdgeIds(allEdges, rectById);
  const liveActive = staleIds.has(id);
  const liveBundle = staleIds.size > 0 ? getLiveBundle(allEdges, rectById, staleIds) : null;
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

  const labelPositions = getLabelPositions(allEdges, rectById, liveBundle?.routes ?? null);
  const labelPosition = labelPositions.get(id) ?? arcMidpoint(pathPoints);
  const labelX = labelPosition.x;
  const labelY = labelPosition.y;

  const sourceColor = data?.sourceColor ?? '#64748b';
  const targetColor = data?.targetColor ?? '#64748b';
  const labelColor = data?.labelColor ?? sourceColor;
  const gradientId  = `oriented-edge-gradient-${id}`;
  const isIndirect  = Boolean(data?.indirect);
  const shouldHideLabels = Boolean(data?.hideEdgeLabels);
  const displayText =
    data?.displayLabel !== undefined ? data.displayLabel : String(label ?? '');
  const canEditLabel = Boolean(data?.onDisplayLabelChange) && !isIndirect;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayText);
  const [localHovered, setLocalHovered] = useState(false);

  function commitLabel() {
    setEditing(false);
    const next = draft.trim();
    if (data?.onDisplayLabelChange && next !== displayText) {
      data.onDisplayLabelChange(next);
    }
  }

  function onLabelDoubleClick(event: MouseEvent) {
    if (!canEditLabel) return;
    event.stopPropagation();
    setDraft(displayText);
    setEditing(true);
  }

  function onLabelKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitLabel();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setEditing(false);
      setDraft(displayText);
    }
  }

  function selectEdge() {
    if (isIndirect) return;
    notifyEdgeDetailsOpen(id);
    data?.onSelect?.();
  }

  const isHovered = Boolean(data?.hovered) || localHovered;
  const shouldShowLabel = isFlowLabelVisible({ text: displayText, shouldHideLabels, isIndirect, isEditing: editing });
  const labelTransform = buildFlowLabelMapTransform(labelX, labelY);
  const isActive = !isIndirect && (isHovered || Boolean(selected));
  const zoomSafe = Math.max(zoom, 0.05);
  // Only the emphasis widths compensate the viewport zoom (RF applies it as a CSS
  // scale) so the highlight stays readable when zoomed out; the resting width is
  // a plain flow-unit value that thins out with the zoom like the rest of the graph.
  const strokeWidth =
    isHovered && !isIndirect
      ? Math.max(REST_STROKE * 1.5, 2.5 / zoomSafe)
      : selected && !isIndirect
        ? Math.max(REST_STROKE * 1.35, 2 / zoomSafe)
        : REST_STROKE;
  const hitStroke = Math.max(32, EDGE_HIT_STROKE / zoomSafe);

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
          strokeWidth,
          opacity: isActive ? 1 : 0.95,
          filter: isActive ? `drop-shadow(0 0 6px ${sourceColor}aa)` : undefined,
          ...(data?.dashed || isIndirect ? { strokeDasharray: '6 4' } : {}),
          transition: 'stroke-width 120ms ease, filter 120ms ease, opacity 120ms ease',
        }}
        interactionWidth={0}
      />
      {/*
        Hit target ~EDGE_HIT_STROKE screen pixels: RF zoom is a CSS transform, so
        stroke width is expressed in flow units and must be divided by the zoom.
      */}
      {!isIndirect ? (
        <path
          d={edgePath}
          fill="none"
          stroke="transparent"
          strokeWidth={hitStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="react-flow__edge-interaction oriented-edge-hit nodrag nopan"
          style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
          onMouseEnter={() => setLocalHovered(true)}
          onMouseLeave={() => setLocalHovered(false)}
          onClick={(event) => {
            if (event.button !== 0) return;
            selectEdge();
          }}
          onDoubleClick={onLabelDoubleClick}
        >
          <title>{canEditLabel ? 'Click for connection details · double-click to edit label' : 'Click for connection details'}</title>
        </path>
      ) : null}
      {isIndirect && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className="oriented-edge-expand nodrag nopan"
            aria-label="Show hidden applications"
            title="Show hidden applications"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              color: sourceColor,
              borderColor: `${sourceColor}66`,
            }}
            onClick={(event) => {
              event.stopPropagation();
              data?.onExpand?.();
            }}
          >
            +
          </button>
        </EdgeLabelRenderer>
      )}
      {!isIndirect && !shouldShowLabel && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className="oriented-edge-hotspot nodrag nopan"
            aria-label="Open connection details"
            title="Click for connection details"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px) scale(${
                1 / Math.max(zoom, 0.05)
              })`,
            }}
            onClick={(event) => {
              event.stopPropagation();
              setLocalHovered(true);
              selectEdge();
            }}
            onDoubleClick={onLabelDoubleClick}
            onMouseEnter={() => setLocalHovered(true)}
            onMouseLeave={() => setLocalHovered(false)}
          />
        </EdgeLabelRenderer>
      )}
      {shouldShowLabel && (
        <EdgeLabelRenderer>
          {editing ? (
            <input
              className="oriented-edge-label oriented-edge-label--input nodrag nopan"
              style={{
                transform: labelTransform,
                fontSize: APPLICATION_TITLE_FONT_SIZE_PX,
                color: labelColor,
                borderColor: `${labelColor}55`,
              }}
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={onLabelKeyDown}
              onClick={(e) => e.stopPropagation()}
              aria-label="Edit edge display label"
            />
          ) : (
            <div
              className={`oriented-edge-label nodrag nopan${canEditLabel ? ' is-editable' : ''}${
                data?.onSelect ? ' is-selectable' : ''
              }`}
              style={{
                transform: labelTransform,
                fontSize: APPLICATION_TITLE_FONT_SIZE_PX,
                color: labelColor,
                borderColor: `${labelColor}55`,
              }}
              onClick={(event) => {
                event.stopPropagation();
                setLocalHovered(true);
                selectEdge();
              }}
              onMouseEnter={() => setLocalHovered(true)}
              onMouseLeave={() => setLocalHovered(false)}
              onDoubleClick={onLabelDoubleClick}
              title={
                canEditLabel
                  ? 'Click for details · double-click to edit label'
                  : data?.onSelect
                    ? 'Click for details'
                    : displayText
              }
            >
              {displayText}
            </div>
          )}
        </EdgeLabelRenderer>
      )}
    </>
  );
}

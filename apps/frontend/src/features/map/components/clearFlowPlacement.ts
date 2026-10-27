import type { Edge, Node } from '@xyflow/react';
import { computeBridges } from './bridges';
import {
  isScoreBetter,
  isScorePerfect,
  scoreCandidateRoute,
  scoreRoutes,
  type PlacementScore,
} from './clearFlowScore';

/** Gap between columns. Wide enough for one elbow to pass beside a card. */
const COLUMN_GAP = 96;
/** Gap between rows. Each application starts on its own row so an elbow misses the other cards. */
const ROW_GAP = 80;
const PORT_MARGIN = 8;
const ORDER_SWEEPS = 4;
const SWEEP_DIRECTION_COUNT = 2;
const POINT_MATCH_DISTANCE = 0.5;
const CENTER_RATIO = 0.5;
const SINGLE_LANE_SHIFT = 0;
const EMPTY_INDEX = 0;
const CELL_STEP = 1;
const MINIMUM_PORT_SPAN = 1;
const MINIMUM_SCORE_WORK = 1;
/** Each accepted move lowers the score, so this only bounds a long run of tiny gains. */
const SEARCH_PASSES = 64;
/** Rough operations spent scoring layouts. Keeps the search well under a second on a large map. */
const SEARCH_WORK_BUDGET = 15_000_000;
/** Width-to-height ratio the packed groups aim for, close to a desktop map pane. */
const PACKED_ASPECT_RATIO = 16 / 9;
const ORIGIN = 0;

export type FlowPoint = { x: number; y: number };

export type FlowPlacementNode = { id: string; width: number; height: number };

export type FlowPlacementEdge = { id: string; source: string; target: string };

export type ClearFlowPlacement = {
  positions: Map<string, { x: number; y: number }>;
  routes: Map<string, FlowPoint[]>;
  hops: Map<string, FlowPoint[]>;
};

type Rect = { id: string; x: number; y: number; width: number; height: number };

type Grid = { row: Map<string, number>; column: Map<string, number> };

type Span = { low: number; high: number };

/** Place the application map: card positions plus one clear orthogonal route per flow. */
export function placeApplicationGraph<N extends Node>(
  nodes: N[],
  edges: Edge[],
  nodeSize: { width: number; height: number },
): { nodes: N[]; routes: Map<string, FlowPoint[]>; hops: Map<string, FlowPoint[]> } {
  const placed = placeClearFlows(
    nodes.map((node) => ({ id: node.id, width: node.width ?? nodeSize.width, height: node.height ?? nodeSize.height })),
    edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
  );
  return {
    nodes: nodes.map((node) => ({ ...node, position: placed.positions.get(node.id) ?? node.position })),
    routes: placed.routes,
    hops: placed.hops,
  };
}

/**
 * Place applications so each flow is orthogonal, straight or one bend, and flows
 * do not share a stretch. A hop is recorded only where a crossing remains.
 *
 * ponytail: one elbow per flow. A node with more flows than fit on a side reuses
 * ports; give that side a second bend channel then.
 */
export function placeClearFlows(
  nodes: readonly FlowPlacementNode[],
  edges: readonly FlowPlacementEdge[],
): ClearFlowPlacement {
  const groups = splitIntoLinkedGroups(nodes, edges).map((group) =>
    placeLinkedGroup({ ...group, workBudget: (SEARCH_WORK_BUDGET * group.nodes.length) / nodes.length }),
  );
  const { positions, routes } = packGroups(groups);
  return { positions, routes, hops: computeBridges(routes) };
}

type LinkedGroup = { nodes: FlowPlacementNode[]; edges: FlowPlacementEdge[] };

type PlacedGroup = { rects: Rect[]; routes: Map<string, FlowPoint[]>; width: number; height: number };

/** Applications with no flow between them never interact, so each linked group is placed on its own. */
function splitIntoLinkedGroups(
  nodes: readonly FlowPlacementNode[],
  edges: readonly FlowPlacementEdge[],
): LinkedGroup[] {
  const groupIndex = labelLinkedGroups(nodes, edges);
  const groups: LinkedGroup[] = [];
  for (const node of nodes) {
    const index = groupIndex.get(node.id) ?? EMPTY_INDEX;
    groups[index] ??= { nodes: [], edges: [] };
    groups[index].nodes.push(node);
  }
  for (const edge of edges) {
    const index = groupIndex.get(edge.source);
    const isInsideOneGroup = index !== undefined && groupIndex.get(edge.target) === index;
    if (isInsideOneGroup) groups[index]?.edges.push(edge);
  }
  return groups;
}

function labelLinkedGroups(
  nodes: readonly FlowPlacementNode[],
  edges: readonly FlowPlacementEdge[],
): Map<string, number> {
  const neighbors = new Map<string, string[]>(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    neighbors.get(edge.source)?.push(edge.target);
    neighbors.get(edge.target)?.push(edge.source);
  }
  const groupIndex = new Map<string, number>();
  let groupCount = EMPTY_INDEX;
  for (const node of nodes) {
    if (groupIndex.has(node.id)) continue;
    const index = groupCount;
    groupCount += CELL_STEP;
    const pending = [node.id];
    groupIndex.set(node.id, index);
    for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
      const unvisited = (neighbors.get(id) ?? []).filter((neighbor) => !groupIndex.has(neighbor));
      for (const neighbor of unvisited) groupIndex.set(neighbor, index);
      pending.push(...unvisited);
    }
  }
  return groupIndex;
}

function placeLinkedGroup(group: LinkedGroup & { workBudget: number }): PlacedGroup {
  const { nodes, edges, workBudget } = group;
  const grid = buildPlacementGrid(nodes, edges);
  moveNodesUntilClear({ nodes, edges, grid, workBudget });
  const rects = [...buildNodeRects(nodes, grid).values()];
  const routes = buildFlowRoutes(new Map(rects.map((rect) => [rect.id, rect])), edges, grid);
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const moved = translateGroup({ rects, routes }, { x: -left, y: -top });
  return {
    ...moved,
    width: Math.max(...moved.rects.map((rect) => rect.x + rect.width)),
    height: Math.max(...moved.rects.map((rect) => rect.y + rect.height)),
  };
}

/** Shelf packing: tallest groups first, wrapping rows near PACKED_ASPECT_RATIO. */
function packGroups(groups: readonly PlacedGroup[]): Omit<ClearFlowPlacement, 'hops'> {
  const positions = new Map<string, FlowPoint>();
  const routes = new Map<string, FlowPoint[]>();
  const rowWidth = measurePackedRowWidth(groups);
  const cursor = { x: ORIGIN, y: ORIGIN, shelfHeight: ORIGIN };
  for (const group of [...groups].sort((upper, lower) => lower.height - upper.height)) {
    const isRowFull = cursor.x > ORIGIN && cursor.x + group.width > rowWidth;
    if (isRowFull) Object.assign(cursor, { x: ORIGIN, y: cursor.y + cursor.shelfHeight + ROW_GAP, shelfHeight: ORIGIN });
    const moved = translateGroup(group, cursor);
    for (const rect of moved.rects) positions.set(rect.id, { x: rect.x, y: rect.y });
    for (const [id, points] of moved.routes) routes.set(id, points);
    cursor.x += group.width + COLUMN_GAP;
    cursor.shelfHeight = Math.max(cursor.shelfHeight, group.height);
  }
  return { positions, routes };
}

function measurePackedRowWidth(groups: readonly PlacedGroup[]): number {
  const totalArea = groups.reduce((sum, group) => sum + (group.width + COLUMN_GAP) * (group.height + ROW_GAP), ORIGIN);
  const widestGroup = Math.max(...groups.map((group) => group.width), ORIGIN);
  return Math.max(widestGroup, Math.sqrt(totalArea * PACKED_ASPECT_RATIO));
}

function translateGroup(
  group: Pick<PlacedGroup, 'rects' | 'routes'>,
  offset: FlowPoint,
): Pick<PlacedGroup, 'rects' | 'routes'> {
  const movePoint = (point: FlowPoint) => ({ x: point.x + offset.x, y: point.y + offset.y });
  return {
    rects: group.rects.map((rect) => ({ ...rect, ...movePoint(rect) })),
    routes: new Map([...group.routes].map(([id, points]) => [id, points.map(movePoint)])),
  };
}

function buildPlacementGrid(nodes: readonly FlowPlacementNode[], edges: readonly FlowPlacementEdge[]): Grid {
  const ids = nodes.map((node) => node.id);
  const rank = calculateRankFromSources(ids, edges);
  const order = orderWithinRank(ids, edges, rank);
  const row = assignRowFromRank(ids, rank, order);
  const column = assignColumnFromPredecessors(ids, edges, row);
  return { row, column };
}

function calculateRankFromSources(ids: readonly string[], edges: readonly FlowPlacementEdge[]): Map<string, number> {
  const incoming = new Map<string, string[]>();
  for (const id of ids) incoming.set(id, []);
  for (const edge of edges) incoming.get(edge.target)?.push(edge.source);
  const rank = new Map<string, number>();
  const visiting = new Set<string>();

  function measureLongestDepth(id: string): number {
    const known = rank.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return EMPTY_INDEX;
    visiting.add(id);
    let best = EMPTY_INDEX;
    for (const source of incoming.get(id) ?? []) best = Math.max(best, measureLongestDepth(source) + CELL_STEP);
    visiting.delete(id);
    rank.set(id, best);
    return best;
  }

  for (const id of ids) measureLongestDepth(id);
  return rank;
}

function orderWithinRank(
  ids: readonly string[],
  edges: readonly FlowPlacementEdge[],
  rank: Map<string, number>,
): Map<string, number> {
  const groups = new Map<number, string[]>();
  for (const id of ids) {
    const key = rank.get(id) ?? EMPTY_INDEX;
    const list = groups.get(key) ?? [];
    list.push(id);
    groups.set(key, list);
  }
  for (const list of groups.values()) list.sort();
  const indexOf = new Map<string, number>();
  const writeIndexes = () => {
    for (const list of groups.values()) list.forEach((id, index) => indexOf.set(id, index));
  };
  writeIndexes();

  for (let sweep = 0; sweep < ORDER_SWEEPS; sweep += 1) {
    const isDownwardSweep = sweep % SWEEP_DIRECTION_COUNT === EMPTY_INDEX;
    const ranks = [...groups.keys()].sort((left, right) => (isDownwardSweep ? left - right : right - left));
    for (const key of ranks) {
      const list = groups.get(key) ?? [];
      list.sort((left, right) => {
        const scoreDelta = calculateBarycenter(left, indexOf, edges) - calculateBarycenter(right, indexOf, edges);
        return scoreDelta || left.localeCompare(right);
      });
    }
    writeIndexes();
  }
  return indexOf;
}

function calculateBarycenter(id: string, indexOf: Map<string, number>, edges: readonly FlowPlacementEdge[]): number {
  const neighbors = edges
    .filter((edge) => edge.source === id || edge.target === id)
    .map((edge) => (edge.source === id ? edge.target : edge.source));
  if (neighbors.length === 0) return indexOf.get(id) ?? EMPTY_INDEX;
  const total = neighbors.reduce((sum, neighbor) => sum + (indexOf.get(neighbor) ?? EMPTY_INDEX), 0);
  return total / neighbors.length;
}

function assignRowFromRank(ids: readonly string[], rank: Map<string, number>, order: Map<string, number>): Map<string, number> {
  const sorted = [...ids].sort((left, right) => {
    const rankDelta = (rank.get(left) ?? EMPTY_INDEX) - (rank.get(right) ?? EMPTY_INDEX);
    if (rankDelta !== 0) return rankDelta;
    return (order.get(left) ?? EMPTY_INDEX) - (order.get(right) ?? EMPTY_INDEX);
  });
  return new Map(sorted.map((id, index) => [id, index]));
}

function assignColumnFromPredecessors(
  ids: readonly string[],
  edges: readonly FlowPlacementEdge[],
  row: Map<string, number>,
): Map<string, number> {
  const incoming = groupIncomingByTarget(ids, edges);
  const column = new Map<string, number>();
  const sorted = [...ids].sort((left, right) => (row.get(left) ?? EMPTY_INDEX) - (row.get(right) ?? EMPTY_INDEX));
  let nextColumn = EMPTY_INDEX;
  for (const id of sorted) {
    const chosen = findOpenPredecessorColumn(id, { incoming, row, column });
    if (chosen === undefined) {
      column.set(id, nextColumn);
      nextColumn += CELL_STEP;
    } else {
      column.set(id, chosen);
    }
  }
  return column;
}

function groupIncomingByTarget(
  ids: readonly string[],
  edges: readonly FlowPlacementEdge[],
): Map<string, string[]> {
  const incoming = new Map<string, string[]>();
  for (const id of ids) incoming.set(id, []);
  for (const edge of edges) incoming.get(edge.target)?.push(edge.source);
  return incoming;
}

function findOpenPredecessorColumn(
  id: string,
  placement: {
    incoming: Map<string, string[]>;
    row: Map<string, number>;
    column: Map<string, number>;
  },
): number | undefined {
  const { incoming, row, column } = placement;
  const predecessors = [...(incoming.get(id) ?? [])].sort(
    (left, right) => (row.get(left) ?? EMPTY_INDEX) - (row.get(right) ?? EMPTY_INDEX),
  );
  for (const predecessor of predecessors) {
    const candidate = column.get(predecessor);
    if (candidate === undefined) continue;
    const isOpen = isLineOpen({
      lineIndex: candidate,
      from: row.get(predecessor) ?? EMPTY_INDEX,
      to: row.get(id) ?? EMPTY_INDEX,
      line: column,
      position: row,
    });
    if (isOpen) return candidate;
  }
  return undefined;
}

/** True when no card sits strictly between `from` and `to` on that grid column or row. */
function isLineOpen(span: {
  lineIndex: number;
  from: number;
  to: number;
  line: Map<string, number>;
  position: Map<string, number>;
}): boolean {
  const { lineIndex, from, to, line, position } = span;
  const low = Math.min(from, to);
  const high = Math.max(from, to);
  for (const [id, placedLine] of line) {
    if (placedLine !== lineIndex) continue;
    const placedPosition = position.get(id) ?? EMPTY_INDEX;
    if (placedPosition > low && placedPosition < high) return false;
  }
  return true;
}

function buildNodeRects(nodes: readonly FlowPlacementNode[], grid: Grid): Map<string, Rect> {
  const rects = new Map<string, Rect>();
  for (const node of nodes) {
    const column = grid.column.get(node.id) ?? EMPTY_INDEX;
    const row = grid.row.get(node.id) ?? EMPTY_INDEX;
    rects.set(node.id, {
      id: node.id,
      x: column * (node.width + COLUMN_GAP),
      y: row * (node.height + ROW_GAP),
      width: node.width,
      height: node.height,
    });
  }
  return rects;
}

function buildFlowRoutes(
  rects: Map<string, Rect>,
  edges: readonly FlowPlacementEdge[],
  grid: Grid,
): Map<string, FlowPoint[]> {
  const straightShift = assignStraightShifts(edges, rects, grid);
  const exitShift = assignExitShifts(edges, rects, grid);
  const entryShift = assignEntryShifts({ edges, rects, grid, straightShift });
  const routes = new Map<string, FlowPoint[]>();
  const straightFirst = [...edges].sort(
    (left, right) => Number(!isStraightPair(left, grid)) - Number(!isStraightPair(right, grid)),
  );
  for (const edge of straightFirst) {
    const source = rects.get(edge.source);
    const target = rects.get(edge.target);
    if (!source || !target) continue;
    const candidates = listRouteCandidates({
      edge,
      source,
      target,
      grid,
      edges,
      rects,
      straightShift,
      exitShift,
      entryShift,
    }).map(simplify);
    routes.set(edge.id, pickFreestRoute({ edge, candidates, drawnRoutes: routes, rects }));
  }
  return routes;
}

/** The first candidate wins ties, so the other L shape is taken only when it is freer. */
function pickFreestRoute(pick: {
  edge: FlowPlacementEdge;
  candidates: FlowPoint[][];
  drawnRoutes: Map<string, FlowPoint[]>;
  rects: Map<string, Rect>;
}): FlowPoint[] {
  const { edge, candidates, drawnRoutes, rects } = pick;
  const scored = candidates.map((points) => ({ points, score: scoreCandidateRoute({ edge, points, drawnRoutes, rects }) }));
  const best = scored.reduce((current, next) => (isScoreBetter(next.score, current.score) ? next : current));
  return best.points;
}

function listRouteCandidates(choice: {
  edge: FlowPlacementEdge;
  source: Rect;
  target: Rect;
  grid: Grid;
  edges: readonly FlowPlacementEdge[];
  rects: Map<string, Rect>;
  straightShift: Map<string, number>;
  exitShift: Map<string, number>;
  entryShift: Map<string, number>;
}): FlowPoint[][] {
  const { edge, source, target, grid, edges, rects, straightShift, exitShift, entryShift } = choice;
  const laneShift = straightShift.get(edge.id) ?? SINGLE_LANE_SHIFT;
  if (isVerticalStraight(edge, grid)) return [buildVerticalRoute(source, target, laneShift)];
  if (isHorizontalStraight(edge, grid)) return [buildHorizontalRoute(source, target, laneShift)];
  const sideEntry = buildSideEntryRoute(source, target, exitShift.get(edge.id) ?? SINGLE_LANE_SHIFT);
  const elbow = buildElbowRoute(source, target, {
    yShift: exitShift.get(edge.id) ?? SINGLE_LANE_SHIFT,
    xShift: entryShift.get(edge.id) ?? SINGLE_LANE_SHIFT,
  });
  return shouldEnterFromSide(edge, { edges, rects, grid, straightShift }) ? [sideEntry, elbow] : [elbow, sideEntry];
}

function assignStraightShifts(
  edges: readonly FlowPlacementEdge[],
  rects: Map<string, Rect>,
  grid: Grid,
): Map<string, number> {
  const shifts = new Map<string, number>();
  writeStraightLanes({
    edges: edges.filter((edge) => isVerticalStraight(edge, grid)),
    rects,
    shifts,
    isVertical: true,
    lineOf: (edge) => String(grid.column.get(edge.source) ?? EMPTY_INDEX),
  });
  writeStraightLanes({
    edges: edges.filter((edge) => isHorizontalStraight(edge, grid)),
    rects,
    shifts,
    isVertical: false,
    lineOf: (edge) => String(grid.row.get(edge.source) ?? EMPTY_INDEX),
  });
  return shifts;
}

function writeStraightLanes(lanes: {
  edges: readonly FlowPlacementEdge[];
  rects: Map<string, Rect>;
  shifts: Map<string, number>;
  isVertical: boolean;
  lineOf: (edge: FlowPlacementEdge) => string;
}): void {
  const { edges, rects, shifts, isVertical, lineOf } = lanes;
  const spanOf = (edge: FlowPlacementEdge) =>
    isVertical ? readVerticalSpan(edge, rects) : readHorizontalSpan(edge, rects);
  for (const list of groupEdges(edges, lineOf).values()) {
    const packed = packLanes(list, spanOf);
    const firstSource = list[EMPTY_INDEX] ? rects.get(list[EMPTY_INDEX].source) : undefined;
    if (!firstSource) continue;
    const offsets = calculateLaneShifts(packed.length, isVertical ? firstSource.width : firstSource.height);
    packed.forEach((members, index) => {
      for (const edge of members) shifts.set(edge.id, offsets[index] ?? SINGLE_LANE_SHIFT);
    });
  }
}

function packLanes(
  edges: readonly FlowPlacementEdge[],
  spanOf: (edge: FlowPlacementEdge) => Span | undefined,
): FlowPlacementEdge[][] {
  const lanes: FlowPlacementEdge[][] = [];
  const readLow = (edge: FlowPlacementEdge) => spanOf(edge)?.low ?? EMPTY_INDEX;
  const ordered = [...edges].sort((left, right) => readLow(left) - readLow(right));
  for (const edge of ordered) {
    const openLane = lanes.find((members) => members.every((other) => !isSpanOverlapping(spanOf(edge), spanOf(other))));
    if (openLane) openLane.push(edge);
    else lanes.push([edge]);
  }
  return lanes;
}

function assignExitShifts(
  edges: readonly FlowPlacementEdge[],
  rects: Map<string, Rect>,
  grid: Grid,
): Map<string, number> {
  const shifts = new Map<string, number>();
  const bySource = groupEdges(edges.filter((edge) => !isStraightPair(edge, grid)), (edge) => edge.source);
  for (const [sourceId, list] of bySource) {
    const source = rects.get(sourceId);
    if (!source) continue;
    const below = list.filter((edge) => isTargetBelow(source, rects.get(edge.target)));
    const above = list.filter((edge) => !isTargetBelow(source, rects.get(edge.target)));
    writeExitOrder({ edges: below, source, rects, shifts, isBelow: true });
    writeExitOrder({ edges: above, source, rects, shifts, isBelow: false });
  }
  return shifts;
}

/** The nearest target gets the port closest to its side, so the elbows nest instead of crossing. */
function writeExitOrder(order: {
  edges: readonly FlowPlacementEdge[];
  source: Rect;
  rects: Map<string, Rect>;
  shifts: Map<string, number>;
  isBelow: boolean;
}): void {
  const { edges, source, rects, shifts, isBelow } = order;
  const nearestFirst = [...edges].sort(
    (left, right) => measureHorizontalDistance(source, rects.get(left.target)) - measureHorizontalDistance(source, rects.get(right.target)),
  );
  const offsets = calculateLaneShifts(nearestFirst.length, source.height);
  const lastIndex = offsets.length - CELL_STEP;
  nearestFirst.forEach((edge, index) => {
    const shift = isBelow ? offsets[lastIndex - index] : offsets[index];
    shifts.set(edge.id, shift ?? SINGLE_LANE_SHIFT);
  });
}

function assignEntryShifts(layout: {
  edges: readonly FlowPlacementEdge[];
  rects: Map<string, Rect>;
  grid: Grid;
  straightShift: Map<string, number>;
}): Map<string, number> {
  const { edges, rects, grid, straightShift } = layout;
  const shifts = new Map<string, number>();
  const bent = edges.filter((edge) => !isStraightPair(edge, grid));
  const byTarget = groupEdges(bent, (edge) => edge.target);
  for (const [targetId, list] of byTarget) {
    const target = rects.get(targetId);
    if (!target) continue;
    const reserved = collectReservedEntryPositions({ target, edges, grid, straightShift });
    const offsets = calculateLaneShifts(list.length + reserved.size, target.width);
    const free = offsets.filter((shift) => !reserved.has(Math.round(readCenterX(target) + shift)));
    list.forEach((edge, index) => shifts.set(edge.id, free[index] ?? offsets[index] ?? SINGLE_LANE_SHIFT));
  }
  return shifts;
}

function shouldEnterFromSide(edge: FlowPlacementEdge, context: RouteContext): boolean {
  const targetColumn = context.grid.column.get(edge.target);
  const hasStraightArrival = context.edges.some((other) => {
    if (other.id === edge.id || !isVerticalStraight(other, context.grid)) return false;
    const isTouchingTarget = other.source === edge.target || other.target === edge.target;
    return isTouchingTarget && context.grid.column.get(other.source) === targetColumn;
  });
  if (!hasStraightArrival) return false;
  return isSourceLaneOpen(edge, context);
}

type RouteContext = {
  edges: readonly FlowPlacementEdge[];
  rects: Map<string, Rect>;
  grid: Grid;
  straightShift: Map<string, number>;
};

function isSourceLaneOpen(edge: FlowPlacementEdge, context: RouteContext): boolean {
  const source = context.rects.get(edge.source);
  const target = context.rects.get(edge.target);
  if (!source || !target) return false;
  const laneX = readCenterX(source);
  const startY = source.y <= target.y ? source.y + source.height : source.y;
  const endY = target.y + target.height * CENTER_RATIO;
  const laneSpan = toSpan(startY, endY);
  const sourceColumn = context.grid.column.get(edge.source);
  return context.edges.every((other) => {
    if (!isVerticalStraight(other, context.grid) || context.grid.column.get(other.source) !== sourceColumn) return true;
    const otherSource = context.rects.get(other.source);
    if (!otherSource) return true;
    const otherX = readCenterX(otherSource) + (context.straightShift.get(other.id) ?? SINGLE_LANE_SHIFT);
    if (Math.abs(otherX - laneX) > POINT_MATCH_DISTANCE) return true;
    return !isSpanOverlapping(readVerticalSpan(other, context.rects), laneSpan);
  });
}

function buildSideEntryRoute(source: Rect, target: Rect, yShift: number): FlowPoint[] {
  const isSourceAbove = source.y <= target.y;
  const isTargetRight = readCenterX(target) >= readCenterX(source);
  const sourceX = readCenterX(source);
  const targetY = clamp(
    target.y + target.height * CENTER_RATIO + yShift,
    target.y + PORT_MARGIN,
    target.y + target.height - PORT_MARGIN,
  );
  return [
    { x: sourceX, y: isSourceAbove ? source.y + source.height : source.y },
    { x: sourceX, y: targetY },
    { x: isTargetRight ? target.x : target.x + target.width, y: targetY },
  ];
}

function isStraightPair(edge: FlowPlacementEdge, grid: Grid): boolean {
  return isVerticalStraight(edge, grid) || isHorizontalStraight(edge, grid);
}

function isVerticalStraight(edge: FlowPlacementEdge, grid: Grid): boolean {
  return isStraightAlong(edge, { line: grid.column, position: grid.row });
}

function isHorizontalStraight(edge: FlowPlacementEdge, grid: Grid): boolean {
  return isStraightAlong(edge, { line: grid.row, position: grid.column });
}

function isStraightAlong(
  edge: FlowPlacementEdge,
  axis: { line: Map<string, number>; position: Map<string, number> },
): boolean {
  const lineIndex = axis.line.get(edge.source) ?? EMPTY_INDEX;
  if (lineIndex !== (axis.line.get(edge.target) ?? EMPTY_INDEX)) return false;
  return isLineOpen({
    lineIndex,
    from: axis.position.get(edge.source) ?? EMPTY_INDEX,
    to: axis.position.get(edge.target) ?? EMPTY_INDEX,
    line: axis.line,
    position: axis.position,
  });
}

function calculateLaneShifts(count: number, span: number): number[] {
  if (count <= 1) return [SINGLE_LANE_SHIFT];
  const usable = Math.max(span - PORT_MARGIN * 2, MINIMUM_PORT_SPAN);
  const shifts: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const ratio = (index + 1) / (count + 1);
    shifts.push((ratio - CENTER_RATIO) * usable);
  }
  return shifts;
}

function groupEdges(
  edges: readonly FlowPlacementEdge[],
  groupOf: (edge: FlowPlacementEdge) => string,
): Map<string, FlowPlacementEdge[]> {
  const groups = new Map<string, FlowPlacementEdge[]>();
  for (const edge of edges) {
    const key = groupOf(edge);
    const list = groups.get(key) ?? [];
    list.push(edge);
    groups.set(key, list);
  }
  return groups;
}

function readCenterX(rect: Rect): number {
  return rect.x + rect.width * CENTER_RATIO;
}

function readVerticalSpan(edge: FlowPlacementEdge, rects: Map<string, Rect>): Span | undefined {
  const source = rects.get(edge.source);
  const target = rects.get(edge.target);
  if (!source || !target) return undefined;
  const isSourceAbove = source.y <= target.y;
  const start = isSourceAbove ? source.y + source.height : source.y;
  const end = isSourceAbove ? target.y : target.y + target.height;
  return toSpan(start, end);
}

function readHorizontalSpan(edge: FlowPlacementEdge, rects: Map<string, Rect>): Span | undefined {
  const source = rects.get(edge.source);
  const target = rects.get(edge.target);
  if (!source || !target) return undefined;
  const isSourceLeft = source.x <= target.x;
  const start = isSourceLeft ? source.x + source.width : source.x;
  const end = isSourceLeft ? target.x : target.x + target.width;
  return toSpan(start, end);
}

function toSpan(start: number, end: number): Span {
  return { low: Math.min(start, end), high: Math.max(start, end) };
}

function isSpanOverlapping(left: Span | undefined, right: Span | undefined): boolean {
  if (!left || !right) return false;
  return Math.min(left.high, right.high) - Math.max(left.low, right.low) > POINT_MATCH_DISTANCE;
}

function isTargetBelow(source: Rect, target: Rect | undefined): boolean {
  if (!target) return true;
  return target.y + target.height * CENTER_RATIO >= source.y + source.height * CENTER_RATIO;
}

function measureHorizontalDistance(source: Rect, target: Rect | undefined): number {
  if (!target) return EMPTY_INDEX;
  return Math.abs(readCenterX(target) - readCenterX(source));
}

function collectReservedEntryPositions(entry: {
  target: Rect;
  edges: readonly FlowPlacementEdge[];
  grid: Grid;
  straightShift: Map<string, number>;
}): Set<number> {
  const { target, edges, grid, straightShift } = entry;
  const reserved = new Set<number>();
  for (const edge of edges) {
    const isTouchingTarget = edge.source === target.id || edge.target === target.id;
    if (!isTouchingTarget || !isVerticalStraight(edge, grid)) continue;
    const shift = straightShift.get(edge.id) ?? SINGLE_LANE_SHIFT;
    reserved.add(Math.round(readCenterX(target) + shift));
  }
  return reserved;
}

function buildVerticalRoute(source: Rect, target: Rect, shift: number): FlowPoint[] {
  const x = source.x + source.width * CENTER_RATIO + shift;
  const isSourceAbove = source.y <= target.y;
  return [
    { x, y: isSourceAbove ? source.y + source.height : source.y },
    { x, y: isSourceAbove ? target.y : target.y + target.height },
  ];
}

function buildHorizontalRoute(source: Rect, target: Rect, shift: number): FlowPoint[] {
  const y = source.y + source.height * CENTER_RATIO + shift;
  const isSourceLeft = source.x <= target.x;
  return [
    { x: isSourceLeft ? source.x + source.width : source.x, y },
    { x: isSourceLeft ? target.x : target.x + target.width, y },
  ];
}

function buildElbowRoute(
  source: Rect,
  target: Rect,
  shifts: { yShift: number; xShift: number },
): FlowPoint[] {
  const { yShift, xShift } = shifts;
  const sourceY = clamp(source.y + source.height * CENTER_RATIO + yShift, source.y + PORT_MARGIN, source.y + source.height - PORT_MARGIN);
  const targetX = clamp(target.x + target.width * CENTER_RATIO + xShift, target.x + PORT_MARGIN, target.x + target.width - PORT_MARGIN);
  const isTargetRight = target.x + target.width * CENTER_RATIO >= source.x + source.width * CENTER_RATIO;
  const isSourceAbove = source.y <= target.y;
  return [
    { x: isTargetRight ? source.x + source.width : source.x, y: sourceY },
    { x: targetX, y: sourceY },
    { x: targetX, y: isSourceAbove ? target.y : target.y + target.height },
  ];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function simplify(points: FlowPoint[]): FlowPoint[] {
  const result: FlowPoint[] = [];
  for (const point of points) {
    const previous = result[result.length - 1];
    const isSamePoint = previous
      && Math.abs(previous.x - point.x) < POINT_MATCH_DISTANCE
      && Math.abs(previous.y - point.y) < POINT_MATCH_DISTANCE;
    if (isSamePoint) continue;
    result.push(point);
  }
  return result;
}

type Cell = { column: number; row: number };

type PlacementSearch = {
  nodes: readonly FlowPlacementNode[];
  edges: readonly FlowPlacementEdge[];
  grid: Grid;
  remainingScores: number;
};

/**
 * ponytail: first-improvement local search over swaps and neighbor-cell moves,
 * bounded by SEARCH_WORK_BUDGET. Finding the best drawing is NP-hard, so on a
 * large or dense map an avoidable crossing can survive as a hop. Upgrade path:
 * a real orthogonal planarization (topology-shape-metrics) pass.
 */
function moveNodesUntilClear(layout: LinkedGroup & { grid: Grid; workBudget: number }): void {
  const { nodes, edges, grid, workBudget } = layout;
  const workPerScore = Math.max(edges.length * edges.length * nodes.length, MINIMUM_SCORE_WORK);
  const search: PlacementSearch = { nodes, edges, grid, remainingScores: Math.floor(workBudget / workPerScore) };
  for (let pass = 0; pass < SEARCH_PASSES; pass += 1) {
    const current = scoreGrid(search);
    if (isScorePerfect(current)) return;
    if (!applySwap(search, current) && !applyNeighborMove(search, current)) return;
  }
}

function applySwap(search: PlacementSearch, current: PlacementScore): boolean {
  const ids = search.nodes.map((node) => node.id);
  for (const [leftIndex, leftId] of ids.entries()) {
    for (const rightId of ids.slice(leftIndex + CELL_STEP)) {
      swapCells(search.grid, leftId, rightId);
      if (isMoveBetter(search, current)) return true;
      swapCells(search.grid, leftId, rightId);
    }
  }
  return false;
}

function applyNeighborMove(search: PlacementSearch, current: PlacementScore): boolean {
  const { grid } = search;
  for (const node of search.nodes) {
    const previous = readCell(grid, node.id);
    for (const cell of listNeighborCells(node.id, search)) {
      if (isCellTaken(grid, cell, node.id)) continue;
      writeCell(grid, node.id, cell);
      if (isMoveBetter(search, current)) return true;
      writeCell(grid, node.id, previous);
    }
  }
  return false;
}

function listNeighborCells(id: string, search: PlacementSearch): Cell[] {
  const neighbors = search.edges
    .filter((edge) => edge.source === id || edge.target === id)
    .map((edge) => (edge.source === id ? edge.target : edge.source));
  return neighbors.flatMap((neighbor) => {
    const { column, row } = readCell(search.grid, neighbor);
    return [
      { column: column + CELL_STEP, row },
      { column: column - CELL_STEP, row },
      { column, row: row + CELL_STEP },
      { column, row: row - CELL_STEP },
    ];
  });
}

function isMoveBetter(search: PlacementSearch, current: PlacementScore): boolean {
  if (search.remainingScores <= EMPTY_INDEX) return false;
  search.remainingScores -= CELL_STEP;
  return isScoreBetter(scoreGrid(search), current);
}

function scoreGrid(search: PlacementSearch): PlacementScore {
  const rects = buildNodeRects(search.nodes, search.grid);
  const routes = buildFlowRoutes(rects, search.edges, search.grid);
  return scoreRoutes({ routes, rects, edges: search.edges });
}

function readCell(grid: Grid, id: string): Cell {
  return { column: grid.column.get(id) ?? EMPTY_INDEX, row: grid.row.get(id) ?? EMPTY_INDEX };
}

function writeCell(grid: Grid, id: string, cell: Cell): void {
  grid.column.set(id, cell.column);
  grid.row.set(id, cell.row);
}

function isCellTaken(grid: Grid, cell: Cell, movingId: string): boolean {
  for (const [id, column] of grid.column) {
    if (id === movingId || column !== cell.column) continue;
    if ((grid.row.get(id) ?? EMPTY_INDEX) === cell.row) return true;
  }
  return false;
}

function swapCells(grid: Grid, leftId: string, rightId: string): void {
  const leftCell = readCell(grid, leftId);
  writeCell(grid, leftId, readCell(grid, rightId));
  writeCell(grid, rightId, leftCell);
}

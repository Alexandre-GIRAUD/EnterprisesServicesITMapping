import { computeBridges } from './bridges';

/** Gap between columns. Wide enough for one elbow to pass beside a card. */
const COLUMN_GAP = 96;
/** Gap between rows. Each application gets its own row so an elbow misses the other cards. */
const ROW_GAP = 80;
const PORT_MARGIN = 8;
const ORDER_SWEEPS = 4;
const POINT_MATCH_DISTANCE = 0.5;
const CENTER_RATIO = 0.5;
const SINGLE_LANE_SHIFT = 0;
const EMPTY_INDEX = 0;
const SEARCH_PASSES = 8;
const MINIMUM_PORT_SPAN = 1;

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

/**
 * Place applications so each flow is orthogonal, straight or one bend, and flows
 * do not share a stretch. A hop is recorded only where a crossing remains.
 *
 * ponytail: one row per application and one elbow per flow. A node with more
 * flows than fit on a side reuses ports; give that side a second bend channel then.
 */
export function placeClearFlows(
  nodes: readonly FlowPlacementNode[],
  edges: readonly FlowPlacementEdge[],
): ClearFlowPlacement {
  const grid = buildPlacementGrid(nodes, edges);
  moveNodesUntilClear(nodes, edges, grid);
  const rects = buildNodeRects(nodes, grid);
  const routes = buildFlowRoutes(rects, edges, grid);
  const positions = new Map<string, { x: number; y: number }>();
  for (const rect of rects.values()) positions.set(rect.id, { x: rect.x, y: rect.y });
  return { positions, routes, hops: computeBridges(routes) };
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
    let best = 0;
    for (const source of incoming.get(id) ?? []) best = Math.max(best, measureLongestDepth(source) + 1);
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
    const ranks = [...groups.keys()].sort((left, right) => (sweep % 2 === 0 ? left - right : right - left));
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
  let nextColumn = 0;
  for (const id of sorted) {
    const chosen = findOpenPredecessorColumn(id, { incoming, row, column });
    if (chosen === undefined) {
      column.set(id, nextColumn);
      nextColumn += 1;
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
    const isOpen = columnIsOpen({
      columnIndex: candidate,
      fromRow: row.get(predecessor) ?? EMPTY_INDEX,
      toRow: row.get(id) ?? EMPTY_INDEX,
      column,
      row,
    });
    if (isOpen) return candidate;
  }
  return undefined;
}

function columnIsOpen(span: {
  columnIndex: number;
  fromRow: number;
  toRow: number;
  column: Map<string, number>;
  row: Map<string, number>;
}): boolean {
  const { columnIndex, fromRow, toRow, column, row } = span;
  const low = Math.min(fromRow, toRow);
  const high = Math.max(fromRow, toRow);
  for (const [id, placedColumn] of column) {
    if (placedColumn !== columnIndex) continue;
    const placedRow = row.get(id) ?? EMPTY_INDEX;
    if (placedRow > low && placedRow < high) return false;
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
  for (const edge of edges) {
    const source = rects.get(edge.source);
    const target = rects.get(edge.target);
    if (!source || !target) continue;
    const points = isStraightPair(edge, grid)
      ? buildVerticalRoute(source, target, straightShift.get(edge.id) ?? SINGLE_LANE_SHIFT)
      : entersFromSide(edge, { edges, rects, grid, straightShift })
        ? buildSideEntryRoute(source, target, exitShift.get(edge.id) ?? SINGLE_LANE_SHIFT)
        : buildElbowRoute(source, target, {
            yShift: exitShift.get(edge.id) ?? SINGLE_LANE_SHIFT,
            xShift: entryShift.get(edge.id) ?? SINGLE_LANE_SHIFT,
          });
    routes.set(edge.id, simplify(points));
  }
  return routes;
}

function assignStraightShifts(
  edges: readonly FlowPlacementEdge[],
  rects: Map<string, Rect>,
  grid: Grid,
): Map<string, number> {
  const shifts = new Map<string, number>();
  const byColumn = new Map<number, FlowPlacementEdge[]>();
  for (const edge of edges) {
    if (!isStraightPair(edge, grid)) continue;
    const column = grid.column.get(edge.source) ?? EMPTY_INDEX;
    const list = byColumn.get(column) ?? [];
    list.push(edge);
    byColumn.set(column, list);
  }
  for (const list of byColumn.values()) {
    const lanes = packLanes(list, rects);
    const width = readWidth(rects.get(list[0]?.source ?? ''));
    const offsets = calculateLaneShifts(lanes.length, width);
    lanes.forEach((members, index) => {
      for (const edge of members) shifts.set(edge.id, offsets[index] ?? SINGLE_LANE_SHIFT);
    });
  }
  return shifts;
}

function packLanes(
  edges: readonly FlowPlacementEdge[],
  rects: Map<string, Rect>,
): FlowPlacementEdge[][] {
  const lanes: FlowPlacementEdge[][] = [];
  const ordered = [...edges].sort((left, right) => readSpanStart(left, rects) - readSpanStart(right, rects));
  for (const edge of ordered) {
    const openLane = lanes.findIndex((members) => members.every((other) => !doSpansOverlap(edge, other, rects)));
    if (openLane < 0) lanes.push([edge]);
    else lanes[openLane].push(edge);
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
    writeExitOrder({ edges: below, source, rects, shifts, direction: 'below' });
    writeExitOrder({ edges: above, source, rects, shifts, direction: 'above' });
  }
  return shifts;
}

function writeExitOrder(order: {
  edges: readonly FlowPlacementEdge[];
  source: Rect;
  rects: Map<string, Rect>;
  shifts: Map<string, number>;
  direction: 'below' | 'above';
}): void {
  const { edges, source, rects, shifts, direction } = order;
  const nearestFirst = [...edges].sort(
    (left, right) => measureHorizontalDistance(source, rects.get(left.target)) - measureHorizontalDistance(source, rects.get(right.target)),
  );
  const offsets = calculateLaneShifts(nearestFirst.length, source.height);
  nearestFirst.forEach((edge, index) => {
    const shift = direction === 'below' ? offsets[offsets.length - 1 - index] : offsets[index];
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

function entersFromSide(edge: FlowPlacementEdge, context: RouteContext): boolean {
  const targetColumn = context.grid.column.get(edge.target);
  const hasStraightArrival = context.edges.some((other) => {
    if (other.id === edge.id || !isStraightPair(other, context.grid)) return false;
    const doesTouchTarget = other.source === edge.target || other.target === edge.target;
    return doesTouchTarget && context.grid.column.get(other.source) === targetColumn;
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
  const endY = target.y + target.height / 2;
  const low = Math.min(startY, endY);
  const high = Math.max(startY, endY);
  const sourceColumn = context.grid.column.get(edge.source);
  return context.edges.every((other) => {
    if (!isStraightPair(other, context.grid) || context.grid.column.get(other.source) !== sourceColumn) return true;
    const otherSource = context.rects.get(other.source);
    if (!otherSource) return true;
    const otherX = readCenterX(otherSource) + (context.straightShift.get(other.id) ?? SINGLE_LANE_SHIFT);
    if (Math.abs(otherX - laneX) > POINT_MATCH_DISTANCE) return true;
    const span = readVerticalSpan(other, context.rects);
    if (!span) return true;
    const overlap = Math.min(span.high, high) - Math.max(span.low, low);
    return overlap <= POINT_MATCH_DISTANCE;
  });
}

function buildSideEntryRoute(source: Rect, target: Rect, yShift: number): FlowPoint[] {
  const sourceIsAbove = source.y <= target.y;
  const targetIsRight = readCenterX(target) >= readCenterX(source);
  const sourceX = readCenterX(source);
  const targetY = clamp(
    target.y + target.height / 2 + yShift,
    target.y + PORT_MARGIN,
    target.y + target.height - PORT_MARGIN,
  );
  return [
    { x: sourceX, y: sourceIsAbove ? source.y + source.height : source.y },
    { x: sourceX, y: targetY },
    { x: targetIsRight ? target.x : target.x + target.width, y: targetY },
  ];
}
function isStraightPair(edge: FlowPlacementEdge, grid: Grid): boolean {
  if ((grid.column.get(edge.source) ?? EMPTY_INDEX) !== (grid.column.get(edge.target) ?? EMPTY_INDEX)) return false;
  return columnIsOpen({
    columnIndex: grid.column.get(edge.source) ?? EMPTY_INDEX,
    fromRow: grid.row.get(edge.source) ?? EMPTY_INDEX,
    toRow: grid.row.get(edge.target) ?? EMPTY_INDEX,
    column: grid.column,
    row: grid.row,
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

function readWidth(rect: Rect | undefined): number {
  return rect?.width ?? MINIMUM_PORT_SPAN;
}

function readCenterX(rect: Rect): number {
  return rect.x + rect.width / 2;
}

function readSpanStart(edge: FlowPlacementEdge, rects: Map<string, Rect>): number {
  return readVerticalSpan(edge, rects)?.low ?? EMPTY_INDEX;
}

function readVerticalSpan(
  edge: FlowPlacementEdge,
  rects: Map<string, Rect>,
): { low: number; high: number } | undefined {
  const source = rects.get(edge.source);
  const target = rects.get(edge.target);
  if (!source || !target) return undefined;
  const sourceIsAbove = source.y <= target.y;
  const start = sourceIsAbove ? source.y + source.height : source.y;
  const end = sourceIsAbove ? target.y : target.y + target.height;
  return { low: Math.min(start, end), high: Math.max(start, end) };
}

function doSpansOverlap(
  left: FlowPlacementEdge,
  right: FlowPlacementEdge,
  rects: Map<string, Rect>,
): boolean {
  const leftSpan = readVerticalSpan(left, rects);
  const rightSpan = readVerticalSpan(right, rects);
  if (!leftSpan || !rightSpan) return false;
  const overlap = Math.min(leftSpan.high, rightSpan.high) - Math.max(leftSpan.low, rightSpan.low);
  return overlap > POINT_MATCH_DISTANCE;
}

function isTargetBelow(source: Rect, target: Rect | undefined): boolean {
  if (!target) return true;
  return target.y + target.height / 2 >= source.y + source.height / 2;
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
    const doesTouchTarget = edge.source === target.id || edge.target === target.id;
    if (!doesTouchTarget || !isStraightPair(edge, grid)) continue;
    const shift = straightShift.get(edge.id) ?? SINGLE_LANE_SHIFT;
    reserved.add(Math.round(readCenterX(target) + shift));
  }
  return reserved;
}

function buildVerticalRoute(source: Rect, target: Rect, shift: number): FlowPoint[] {
  const x = source.x + source.width / 2 + shift;
  const sourceIsAbove = source.y <= target.y;
  return [
    { x, y: sourceIsAbove ? source.y + source.height : source.y },
    { x, y: sourceIsAbove ? target.y : target.y + target.height },
  ];
}

function buildElbowRoute(
  source: Rect,
  target: Rect,
  shifts: { yShift: number; xShift: number },
): FlowPoint[] {
  const { yShift, xShift } = shifts;
  const sourceY = clamp(source.y + source.height / 2 + yShift, source.y + PORT_MARGIN, source.y + source.height - PORT_MARGIN);
  const targetX = clamp(target.x + target.width / 2 + xShift, target.x + PORT_MARGIN, target.x + target.width - PORT_MARGIN);
  const targetIsRight = target.x + target.width / 2 >= source.x + source.width / 2;
  const sourceIsAbove = source.y <= target.y;
  return [
    { x: targetIsRight ? source.x + source.width : source.x, y: sourceY },
    { x: targetX, y: sourceY },
    { x: targetX, y: sourceIsAbove ? target.y : target.y + target.height },
  ];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
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

/**
 * ponytail: a handful of swaps and neighbor-cell moves. Stops when the map is
 * clear or no move helps. A graph that cannot be drawn in one bend still hops.
 */
function moveNodesUntilClear(
  nodes: readonly FlowPlacementNode[],
  edges: readonly FlowPlacementEdge[],
  grid: Grid,
): void {
  for (let pass = 0; pass < SEARCH_PASSES; pass += 1) {
    const current = scorePlacement(nodes, edges, grid);
    if (current.crossings === 0 && current.cuts === 0 && !current.sharesStretch) return;
    if (!applyClearerMove(nodes, edges, grid, current)) return;
  }
}

function applyClearerMove(
  nodes: readonly FlowPlacementNode[],
  edges: readonly FlowPlacementEdge[],
  grid: Grid,
  current: PlacementScore,
): boolean {
  if (applySwap(nodes, edges, grid, current)) return true;
  return applyNeighborMove(nodes, edges, grid, current);
}

function applySwap(
  nodes: readonly FlowPlacementNode[],
  edges: readonly FlowPlacementEdge[],
  grid: Grid,
  current: PlacementScore,
): boolean {
  const ids = nodes.map((node) => node.id);
  for (let left = 0; left < ids.length; left += 1) {
    for (let right = left + 1; right < ids.length; right += 1) {
      const leftId = ids[left];
      const rightId = ids[right];
      if (!leftId || !rightId) continue;
      swapCells(grid, leftId, rightId);
      if (acceptMove(nodes, edges, grid, current)) return true;
      swapCells(grid, leftId, rightId);
    }
  }
  return false;
}

function applyNeighborMove(
  nodes: readonly FlowPlacementNode[],
  edges: readonly FlowPlacementEdge[],
  grid: Grid,
  current: PlacementScore,
): boolean {
  for (const node of nodes) {
    for (const cell of neighborCells(node.id, edges, grid)) {
      if (isCellTaken(grid, cell, node.id)) continue;
      const previous = { column: grid.column.get(node.id) ?? EMPTY_INDEX, row: grid.row.get(node.id) ?? EMPTY_INDEX };
      grid.column.set(node.id, cell.column);
      grid.row.set(node.id, cell.row);
      if (acceptMove(nodes, edges, grid, current)) return true;
      grid.column.set(node.id, previous.column);
      grid.row.set(node.id, previous.row);
    }
  }
  return false;
}

function neighborCells(
  id: string,
  edges: readonly FlowPlacementEdge[],
  grid: Grid,
): { column: number; row: number }[] {
  const neighbors = edges
    .filter((edge) => edge.source === id || edge.target === id)
    .map((edge) => (edge.source === id ? edge.target : edge.source));
  const cells: { column: number; row: number }[] = [];
  for (const neighbor of neighbors) {
    const column = grid.column.get(neighbor) ?? EMPTY_INDEX;
    const row = grid.row.get(neighbor) ?? EMPTY_INDEX;
    cells.push({ column: column + 1, row });
    cells.push({ column: column - 1, row });
    cells.push({ column, row: row + 1 });
    cells.push({ column, row: row - 1 });
  }
  return cells;
}

function acceptMove(
  nodes: readonly FlowPlacementNode[],
  edges: readonly FlowPlacementEdge[],
  grid: Grid,
  current: PlacementScore,
): boolean {
  const next = scorePlacement(nodes, edges, grid);
  if (next.sharesStretch && !current.sharesStretch) return false;
  if (next.cuts !== current.cuts) return next.cuts < current.cuts;
  if (next.crossings !== current.crossings) return next.crossings < current.crossings;
  return next.bends < current.bends;
}

type PlacementScore = { crossings: number; sharesStretch: boolean; bends: number; cuts: number };

function scorePlacement(
  nodes: readonly FlowPlacementNode[],
  edges: readonly FlowPlacementEdge[],
  grid: Grid,
): PlacementScore {
  const rects = buildNodeRects(nodes, grid);
  const routes = buildFlowRoutes(rects, edges, grid);
  return {
    crossings: countRouteCrossings(routes),
    sharesStretch: haveSharedStretch(routes),
    bends: countBends(routes),
    cuts: countNodeCuts(routes, rects, edges),
  };
}

function countNodeCuts(
  routes: Map<string, FlowPoint[]>,
  rects: Map<string, Rect>,
  edges: readonly FlowPlacementEdge[],
): number {
  const edgeById = new Map(edges.map((edge) => [edge.id, edge]));
  let cuts = 0;
  for (const segment of listSegments(routes)) {
    const edge = edgeById.get(segment.id);
    for (const rect of rects.values()) {
      if (rect.id === edge?.source || rect.id === edge?.target) continue;
      if (segmentCutsRect(segment, rect)) cuts += 1;
    }
  }
  return cuts;
}

function segmentCutsRect(segment: RouteSegment, rect: Rect): boolean {
  const isHorizontal = Math.abs(segment.y1 - segment.y2) < POINT_MATCH_DISTANCE;
  if (isHorizontal) {
    const y = segment.y1;
    const isInsideVerticalSpan = y > rect.y + POINT_MATCH_DISTANCE && y < rect.y + rect.height - POINT_MATCH_DISTANCE;
    return isInsideVerticalSpan && rangesOverlap(segment.x1, segment.x2, rect.x, rect.x + rect.width);
  }
  const x = segment.x1;
  const isInsideHorizontalSpan = x > rect.x + POINT_MATCH_DISTANCE && x < rect.x + rect.width - POINT_MATCH_DISTANCE;
  return isInsideHorizontalSpan && rangesOverlap(segment.y1, segment.y2, rect.y, rect.y + rect.height);
}

function countBends(routes: Map<string, FlowPoint[]>): number {
  let bends = 0;
  for (const points of routes.values()) {
    for (let index = 1; index < points.length - 1; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      const next = points[index + 1];
      if (!previous || !current || !next) continue;
      const isSameX = Math.abs(previous.x - current.x) < POINT_MATCH_DISTANCE && Math.abs(current.x - next.x) < POINT_MATCH_DISTANCE;
      const isSameY = Math.abs(previous.y - current.y) < POINT_MATCH_DISTANCE && Math.abs(current.y - next.y) < POINT_MATCH_DISTANCE;
      if (!isSameX && !isSameY) bends += 1;
    }
  }
  return bends;
}

function haveSharedStretch(routes: Map<string, FlowPoint[]>): boolean {
  const segments = listSegments(routes);
  for (let left = 0; left < segments.length; left += 1) {
    for (let right = left + 1; right < segments.length; right += 1) {
      const leftSegment = segments[left];
      const rightSegment = segments[right];
      if (!leftSegment || !rightSegment || leftSegment.id === rightSegment.id) continue;
      if (segmentsShareStretch(leftSegment, rightSegment)) return true;
    }
  }
  return false;
}

function segmentsShareStretch(left: RouteSegment, right: RouteSegment): boolean {
  const isHorizontalPair = Math.abs(left.y1 - left.y2) < POINT_MATCH_DISTANCE
    && Math.abs(right.y1 - right.y2) < POINT_MATCH_DISTANCE
    && Math.abs(left.y1 - right.y1) < POINT_MATCH_DISTANCE;
  const isVerticalPair = Math.abs(left.x1 - left.x2) < POINT_MATCH_DISTANCE
    && Math.abs(right.x1 - right.x2) < POINT_MATCH_DISTANCE
    && Math.abs(left.x1 - right.x1) < POINT_MATCH_DISTANCE;
  if (isHorizontalPair) return rangesOverlap(left.x1, left.x2, right.x1, right.x2);
  if (isVerticalPair) return rangesOverlap(left.y1, left.y2, right.y1, right.y2);
  return false;
}

function countRouteCrossings(routes: Map<string, FlowPoint[]>): number {
  const segments = listSegments(routes);
  let crossings = 0;
  for (const horizontal of segments) {
    if (Math.abs(horizontal.y1 - horizontal.y2) >= POINT_MATCH_DISTANCE) continue;
    for (const vertical of segments) {
      if (horizontal.id === vertical.id) continue;
      if (Math.abs(vertical.x1 - vertical.x2) >= POINT_MATCH_DISTANCE) continue;
      if (segmentsCross(horizontal, vertical)) crossings += 1;
    }
  }
  return crossings;
}

function segmentsCross(horizontal: RouteSegment, vertical: RouteSegment): boolean {
  const isInsideHorizontal = vertical.x1 > Math.min(horizontal.x1, horizontal.x2) + POINT_MATCH_DISTANCE
    && vertical.x1 < Math.max(horizontal.x1, horizontal.x2) - POINT_MATCH_DISTANCE;
  const isInsideVertical = horizontal.y1 > Math.min(vertical.y1, vertical.y2) + POINT_MATCH_DISTANCE
    && horizontal.y1 < Math.max(vertical.y1, vertical.y2) - POINT_MATCH_DISTANCE;
  return isInsideHorizontal && isInsideVertical;
}

function rangesOverlap(firstStart: number, firstEnd: number, secondStart: number, secondEnd: number): boolean {
  const overlapStart = Math.max(Math.min(firstStart, firstEnd), Math.min(secondStart, secondEnd));
  const overlapEnd = Math.min(Math.max(firstStart, firstEnd), Math.max(secondStart, secondEnd));
  return overlapEnd - overlapStart > POINT_MATCH_DISTANCE;
}

type RouteSegment = { id: string; x1: number; y1: number; x2: number; y2: number };

function listSegments(routes: Map<string, FlowPoint[]>): RouteSegment[] {
  const segments: RouteSegment[] = [];
  for (const [id, points] of routes) {
    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      if (!start || !end) continue;
      segments.push({ id, x1: start.x, y1: start.y, x2: end.x, y2: end.y });
    }
  }
  return segments;
}

function isCellTaken(grid: Grid, cell: { column: number; row: number }, exceptId: string): boolean {
  for (const [id, column] of grid.column) {
    if (id === exceptId || column !== cell.column) continue;
    if ((grid.row.get(id) ?? EMPTY_INDEX) === cell.row) return true;
  }
  return false;
}

function swapCells(grid: Grid, leftId: string, rightId: string): void {
  const leftColumn = grid.column.get(leftId) ?? EMPTY_INDEX;
  const leftRow = grid.row.get(leftId) ?? EMPTY_INDEX;
  grid.column.set(leftId, grid.column.get(rightId) ?? EMPTY_INDEX);
  grid.row.set(leftId, grid.row.get(rightId) ?? EMPTY_INDEX);
  grid.column.set(rightId, leftColumn);
  grid.row.set(rightId, leftRow);
}

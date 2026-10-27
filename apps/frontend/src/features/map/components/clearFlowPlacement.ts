import { computeBridges } from './bridges';

/** Gap between columns. Wide enough for one elbow to pass beside a card. */
const COLUMN_GAP = 96;
/** Gap between rows. Each application gets its own row so an elbow misses the other cards. */
const ROW_GAP = 80;
const PORT_MARGIN = 8;
const ORDER_SWEEPS = 4;
const POINT_MATCH_DISTANCE = 0.5;

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
  const grid = gridFor(nodes, edges);
  const rects = rectsFor(nodes, grid);
  const routes = routesFor(rects, edges, grid);
  const positions = new Map<string, { x: number; y: number }>();
  for (const rect of rects.values()) positions.set(rect.id, { x: rect.x, y: rect.y });
  return { positions, routes, hops: computeBridges(routes) };
}

function gridFor(nodes: readonly FlowPlacementNode[], edges: readonly FlowPlacementEdge[]): Grid {
  const ids = nodes.map((node) => node.id);
  const rank = rankFromSources(ids, edges);
  const order = orderWithinRank(ids, edges, rank);
  const row = rowFromRank(ids, rank, order);
  const column = columnFromPredecessors(ids, edges, row);
  return { row, column };
}

function rankFromSources(ids: readonly string[], edges: readonly FlowPlacementEdge[]): Map<string, number> {
  const incoming = new Map<string, string[]>();
  for (const id of ids) incoming.set(id, []);
  for (const edge of edges) incoming.get(edge.target)?.push(edge.source);
  const rank = new Map<string, number>();
  const visiting = new Set<string>();

  function depth(id: string): number {
    const known = rank.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let best = 0;
    for (const source of incoming.get(id) ?? []) best = Math.max(best, depth(source) + 1);
    visiting.delete(id);
    rank.set(id, best);
    return best;
  }

  for (const id of ids) depth(id);
  return rank;
}

function orderWithinRank(
  ids: readonly string[],
  edges: readonly FlowPlacementEdge[],
  rank: Map<string, number>,
): Map<string, number> {
  const groups = new Map<number, string[]>();
  for (const id of ids) {
    const key = rank.get(id) ?? 0;
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
        const scoreDelta = barycenter(left, indexOf, edges) - barycenter(right, indexOf, edges);
        return scoreDelta || left.localeCompare(right);
      });
    }
    writeIndexes();
  }
  return indexOf;
}

function barycenter(id: string, indexOf: Map<string, number>, edges: readonly FlowPlacementEdge[]): number {
  const neighbors = edges
    .filter((edge) => edge.source === id || edge.target === id)
    .map((edge) => (edge.source === id ? edge.target : edge.source));
  if (neighbors.length === 0) return indexOf.get(id) ?? 0;
  const total = neighbors.reduce((sum, neighbor) => sum + (indexOf.get(neighbor) ?? 0), 0);
  return total / neighbors.length;
}

function rowFromRank(ids: readonly string[], rank: Map<string, number>, order: Map<string, number>): Map<string, number> {
  const sorted = [...ids].sort((left, right) => {
    const rankDelta = (rank.get(left) ?? 0) - (rank.get(right) ?? 0);
    if (rankDelta !== 0) return rankDelta;
    return (order.get(left) ?? 0) - (order.get(right) ?? 0);
  });
  return new Map(sorted.map((id, index) => [id, index]));
}

function columnFromPredecessors(
  ids: readonly string[],
  edges: readonly FlowPlacementEdge[],
  row: Map<string, number>,
): Map<string, number> {
  const incoming = incomingByTarget(ids, edges);
  const column = new Map<string, number>();
  const sorted = [...ids].sort((left, right) => (row.get(left) ?? 0) - (row.get(right) ?? 0));
  let nextColumn = 0;
  for (const id of sorted) {
    const chosen = openPredecessorColumn(id, { incoming, row, column });
    if (chosen === undefined) {
      column.set(id, nextColumn);
      nextColumn += 1;
    } else {
      column.set(id, chosen);
    }
  }
  return column;
}

function incomingByTarget(
  ids: readonly string[],
  edges: readonly FlowPlacementEdge[],
): Map<string, string[]> {
  const incoming = new Map<string, string[]>();
  for (const id of ids) incoming.set(id, []);
  for (const edge of edges) incoming.get(edge.target)?.push(edge.source);
  return incoming;
}

function openPredecessorColumn(
  id: string,
  placement: {
    incoming: Map<string, string[]>;
    row: Map<string, number>;
    column: Map<string, number>;
  },
): number | undefined {
  const { incoming, row, column } = placement;
  const predecessors = [...(incoming.get(id) ?? [])].sort(
    (left, right) => (row.get(left) ?? 0) - (row.get(right) ?? 0),
  );
  for (const predecessor of predecessors) {
    const candidate = column.get(predecessor);
    if (candidate === undefined) continue;
    const isOpen = columnIsOpen({
      columnIndex: candidate,
      fromRow: row.get(predecessor) ?? 0,
      toRow: row.get(id) ?? 0,
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
    const placedRow = row.get(id) ?? 0;
    if (placedRow > low && placedRow < high) return false;
  }
  return true;
}

function rectsFor(nodes: readonly FlowPlacementNode[], grid: Grid): Map<string, Rect> {
  const rects = new Map<string, Rect>();
  for (const node of nodes) {
    const column = grid.column.get(node.id) ?? 0;
    const row = grid.row.get(node.id) ?? 0;
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

function routesFor(
  rects: Map<string, Rect>,
  edges: readonly FlowPlacementEdge[],
  grid: Grid,
): Map<string, FlowPoint[]> {
  const straight = edges.filter((edge) => isStraightPair(edge, grid));
  const bent = edges.filter((edge) => !isStraightPair(edge, grid));
  const shiftX = shiftsByGroup(straight, (edge) => `${edge.source}>${edge.target}`, (edge) => widthOf(rects.get(edge.source)));
  const exitY = shiftsByGroup(bent, (edge) => edge.source, (edge) => heightOf(rects.get(edge.source)));
  const entryX = shiftsByGroup(bent, (edge) => edge.target, (edge) => widthOf(rects.get(edge.target)));
  const routes = new Map<string, FlowPoint[]>();
  for (const edge of edges) {
    const source = rects.get(edge.source);
    const target = rects.get(edge.target);
    if (!source || !target) continue;
    const points = isStraightPair(edge, grid)
      ? verticalRoute(source, target, shiftX.get(edge.id) ?? 0)
      : elbowRoute(source, target, {
          yShift: exitY.get(edge.id) ?? 0,
          xShift: entryX.get(edge.id) ?? 0,
        });
    routes.set(edge.id, simplify(points));
  }
  return routes;
}

function isStraightPair(edge: FlowPlacementEdge, grid: Grid): boolean {
  if ((grid.column.get(edge.source) ?? 0) !== (grid.column.get(edge.target) ?? 0)) return false;
  return columnIsOpen({
    columnIndex: grid.column.get(edge.source) ?? 0,
    fromRow: grid.row.get(edge.source) ?? 0,
    toRow: grid.row.get(edge.target) ?? 0,
    column: grid.column,
    row: grid.row,
  });
}

function shiftsByGroup(
  edges: readonly FlowPlacementEdge[],
  groupOf: (edge: FlowPlacementEdge) => string,
  spanOf: (edge: FlowPlacementEdge) => number,
): Map<string, number> {
  const groups = new Map<string, FlowPlacementEdge[]>();
  for (const edge of edges) {
    const key = groupOf(edge);
    const list = groups.get(key) ?? [];
    list.push(edge);
    groups.set(key, list);
  }
  const shifts = new Map<string, number>();
  for (const list of groups.values()) {
    const span = Math.max(spanOf(list[0]) - PORT_MARGIN * 2, 1);
    list.forEach((edge, index) => {
      const ratio = list.length === 1 ? 0.5 : (index + 1) / (list.length + 1);
      shifts.set(edge.id, (ratio - 0.5) * span);
    });
  }
  return shifts;
}

function widthOf(rect: Rect | undefined): number {
  return rect?.width ?? 1;
}

function heightOf(rect: Rect | undefined): number {
  return rect?.height ?? 1;
}

function verticalRoute(source: Rect, target: Rect, shift: number): FlowPoint[] {
  const x = source.x + source.width / 2 + shift;
  const sourceIsAbove = source.y <= target.y;
  return [
    { x, y: sourceIsAbove ? source.y + source.height : source.y },
    { x, y: sourceIsAbove ? target.y : target.y + target.height },
  ];
}

function elbowRoute(
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
    const samePoint = previous
      && Math.abs(previous.x - point.x) < POINT_MATCH_DISTANCE
      && Math.abs(previous.y - point.y) < POINT_MATCH_DISTANCE;
    if (samePoint) continue;
    result.push(point);
  }
  return result;
}

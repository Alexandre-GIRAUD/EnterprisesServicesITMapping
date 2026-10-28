import type { Edge, Node } from '@xyflow/react';
import { computeBridges } from './bridges';
import { COMPONENT_GAP, findConnectedComponents, packComponentOffsets } from './graphComponents';
import {
  POINT_MATCH_DISTANCE,
  buildSpan,
  isScoreBetter,
  isScorePerfect,
  isSpanOverlapping,
  scoreCandidateRoutes,
  scoreRoutes,
  type Card,
  type PlacementScore,
  type Span,
} from './clearFlowScore';

/** Gap between columns. Wide enough for one elbow to pass beside a card. */
const COLUMN_GAP = 96;
/** Gap between rows. One row per dependency depth, so an elbow can pass between layers. */
const ROW_GAP = 80;
const PORT_MARGIN = 8;
const ORDER_SWEEPS = 4;
const SWEEP_DIRECTION_COUNT = 2;
const CENTER_RATIO = 0.5;
const SINGLE_LANE_SHIFT = 0;
const SINGLE_LANE_COUNT = 1;
/** Ports tried on each card border when the preferred L shapes are blocked. */
const COARSE_PORT_SLOT_COUNT = 5;
/** Only a flow still sharing a stretch after the coarse grid pays for the finer one, so dense maps stay fast. */
const FINE_PORT_SLOT_COUNT = 7;
/** A port margin is kept on both ends of a card border. */
const BORDER_SIDES = 2;
const EMPTY_INDEX = 0;
const CELL_STEP = 1;
const MINIMUM_PORT_SPAN = 1;
const MINIMUM_SCORE_WORK = 1;
/** Each accepted move lowers the score, so this only bounds a long run of tiny gains. */
const SEARCH_PASSES = 64;
/** Rough operations spent scoring layouts. Keeps the search well under a second on a large map. */
const SEARCH_WORK_BUDGET = 15_000_000;
/** Width-to-height ratio the packed groups aim for, close to a desktop map pane. Each group keeps its zone frame. */
const PACKED_ASPECT_RATIO = 16 / 9;
const ORIGIN = 0;

export type FlowPoint = { x: number; y: number };

type FlowPlacementNode = { id: string; width: number; height: number };

export type FlowPlacementEdge = { id: string; source: string; target: string };

type ClearFlowPlacement = {
  positions: Map<string, FlowPoint>;
  routes: Map<string, FlowPoint[]>;
  hops: Map<string, FlowPoint[]>;
};

type Grid = { row: Map<string, number>; column: Map<string, number> };

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
  const offsets = packComponentOffsets(groups, COMPONENT_GAP, PACKED_ASPECT_RATIO);
  const positions = new Map<string, FlowPoint>();
  const routes = new Map<string, FlowPoint[]>();
  groups.forEach((group, index) => {
    const moved = translateGroup(group, offsets[index] ?? { x: ORIGIN, y: ORIGIN });
    for (const card of moved.cards) positions.set(card.id, { x: card.x, y: card.y });
    for (const [id, points] of moved.routes) routes.set(id, points);
  });
  return { positions, routes, hops: computeBridges(routes) };
}

type LinkedGroup = { nodes: FlowPlacementNode[]; edges: FlowPlacementEdge[] };

type PlacedGroup = { cards: Card[]; routes: Map<string, FlowPoint[]>; width: number; height: number };

/** Applications with no flow between them never interact, so each linked group is placed on its own. */
function splitIntoLinkedGroups(
  nodes: readonly FlowPlacementNode[],
  edges: readonly FlowPlacementEdge[],
): LinkedGroup[] {
  const groupIndex = new Map<string, number>();
  const components = findConnectedComponents(nodes.map((node) => node.id), edges);
  components.forEach((ids, index) => ids.forEach((id) => groupIndex.set(id, index)));
  const groups: LinkedGroup[] = components.map(() => ({ nodes: [], edges: [] }));
  for (const node of nodes) groups[groupIndex.get(node.id) ?? EMPTY_INDEX]?.nodes.push(node);
  for (const edge of edges) {
    const index = groupIndex.get(edge.source);
    const isInsideOneGroup = index !== undefined && groupIndex.get(edge.target) === index;
    if (isInsideOneGroup) groups[index]?.edges.push(edge);
  }
  return groups;
}

function placeLinkedGroup(group: LinkedGroup & { workBudget: number }): PlacedGroup {
  const layered = drawGroup(group, buildLayeredGrid(group.nodes, group.edges));
  if (!hasSharedFlowStretch(layered, group.edges)) return layered;
  return drawGroup(group, buildSpreadGrid(group.nodes, group.edges));
}

function drawGroup(group: LinkedGroup & { workBudget: number }, grid: Grid): PlacedGroup {
  const { nodes, edges, workBudget } = group;
  moveNodesUntilClear({ nodes, edges, grid, workBudget });
  const cards = [...buildNodeCards(nodes, grid).values()];
  const routes = buildFlowRoutes({
    cards: new Map(cards.map((card) => [card.id, card])),
    edges,
    grid,
    shouldTryEveryPort: true,
  });
  const left = Math.min(...cards.map((card) => card.x));
  const top = Math.min(...cards.map((card) => card.y));
  const moved = translateGroup({ cards, routes }, { x: -left, y: -top });
  return {
    ...moved,
    width: Math.max(...moved.cards.map((card) => card.x + card.width)),
    height: Math.max(...moved.cards.map((card) => card.y + card.height)),
  };
}

function hasSharedFlowStretch(placed: Pick<PlacedGroup, 'cards' | 'routes'>, edges: readonly FlowPlacementEdge[]): boolean {
  const cards = new Map(placed.cards.map((card) => [card.id, card]));
  return scoreRoutes({ routes: placed.routes, cards, edges }).sharedStretches > 0;
}

function translateGroup(
  group: Pick<PlacedGroup, 'cards' | 'routes'>,
  offset: FlowPoint,
): Pick<PlacedGroup, 'cards' | 'routes'> {
  const movePoint = (point: FlowPoint) => ({ x: point.x + offset.x, y: point.y + offset.y });
  return {
    cards: group.cards.map((card) => ({ ...card, ...movePoint(card) })),
    routes: new Map([...group.routes].map(([id, points]) => [id, points.map(movePoint)])),
  };
}

function buildLayeredGrid(nodes: readonly FlowPlacementNode[], edges: readonly FlowPlacementEdge[]): Grid {
  const ids = nodes.map((node) => node.id);
  const rank = calculateRankFromSources(ids, edges);
  const order = orderWithinRank(ids, edges, rank);
  return assignLayeredCells({ ids, rank, order, pitchRatio: layerPitchRatio(nodes) });
}

function layerPitchRatio(nodes: readonly FlowPlacementNode[]): number {
  const sample = nodes[EMPTY_INDEX];
  const width = sample?.width ?? MINIMUM_PORT_SPAN;
  const height = sample?.height ?? MINIMUM_PORT_SPAN;
  return (width + COLUMN_GAP) / (height + ROW_GAP);
}

/**
 * One card per row. Used only when a layered drawing still stacks two flows on
 * the same stretch, which a deep dense map can do.
 */
function buildSpreadGrid(nodes: readonly FlowPlacementNode[], edges: readonly FlowPlacementEdge[]): Grid {
  const ids = nodes.map((node) => node.id);
  const rank = calculateRankFromSources(ids, edges);
  const order = orderWithinRank(ids, edges, rank);
  const row = assignSpreadRows(ids, rank, order);
  return { row, column: assignColumnFromPredecessors(ids, edges, row) };
}

function calculateRankFromSources(ids: readonly string[], edges: readonly FlowPlacementEdge[]): Map<string, number> {
  const incoming = groupIncomingByTarget(ids, edges);
  const rank = new Map<string, number>();
  const visiting = new Set<string>();

  function measureLongestDepth(id: string): number {
    const known = rank.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0;
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
  const groups = groupIdsByRank(ids, rank);
  let indexOf = readIndexesWithinRank(groups);
  for (let sweep = 0; sweep < ORDER_SWEEPS; sweep += 1) {
    const isDownwardSweep = sweep % SWEEP_DIRECTION_COUNT === 0;
    sortRanksByBarycenter({ groups, indexOf, edges, isDownwardSweep });
    indexOf = readIndexesWithinRank(groups);
  }
  return indexOf;
}

function groupIdsByRank(ids: readonly string[], rank: Map<string, number>): Map<number, string[]> {
  const groups = new Map<number, string[]>();
  for (const id of ids) {
    const key = rank.get(id) ?? EMPTY_INDEX;
    const list = groups.get(key) ?? [];
    list.push(id);
    groups.set(key, list);
  }
  for (const list of groups.values()) list.sort();
  return groups;
}

function readIndexesWithinRank(groups: Map<number, string[]>): Map<string, number> {
  const indexOf = new Map<string, number>();
  for (const list of groups.values()) list.forEach((id, index) => indexOf.set(id, index));
  return indexOf;
}

/** Indexes are read once per sweep, so every rank in a sweep sorts against the same order. */
function sortRanksByBarycenter(sweep: {
  groups: Map<number, string[]>;
  indexOf: Map<string, number>;
  edges: readonly FlowPlacementEdge[];
  isDownwardSweep: boolean;
}): void {
  const { groups, indexOf, edges, isDownwardSweep } = sweep;
  const ranks = [...groups.keys()].sort((left, right) => (isDownwardSweep ? left - right : right - left));
  const compareByBarycenter = (left: string, right: string) =>
    calculateBarycenter(left, indexOf, edges) - calculateBarycenter(right, indexOf, edges) || left.localeCompare(right);
  for (const key of ranks) groups.get(key)?.sort(compareByBarycenter);
}

function calculateBarycenter(id: string, indexOf: Map<string, number>, edges: readonly FlowPlacementEdge[]): number {
  const neighbors = edges
    .filter((edge) => edge.source === id || edge.target === id)
    .map((edge) => (edge.source === id ? edge.target : edge.source));
  if (neighbors.length === 0) return indexOf.get(id) ?? EMPTY_INDEX;
  const total = neighbors.reduce((sum, neighbor) => sum + (indexOf.get(neighbor) ?? EMPTY_INDEX), 0);
  return total / neighbors.length;
}

/**
 * Applications at the same depth stay together. A depth wider than the screen
 * wraps onto extra rows so the group is close to the map pane's shape.
 */
function assignLayeredCells(layout: {
  ids: readonly string[];
  rank: Map<string, number>;
  order: Map<string, number>;
  pitchRatio: number;
}): Grid {
  const { ids, rank, order, pitchRatio } = layout;
  const layers = groupIdsByRank(ids, rank);
  const cardsPerRow = chooseCardsPerRow([...layers.values()].map((layer) => layer.length), pitchRatio);
  const row = new Map<string, number>();
  const column = new Map<string, number>();
  let nextRow = EMPTY_INDEX;
  for (const key of [...layers.keys()].sort((left, right) => left - right)) {
    const layer = [...(layers.get(key) ?? [])].sort(
      (left, right) => (order.get(left) ?? EMPTY_INDEX) - (order.get(right) ?? EMPTY_INDEX),
    );
    layer.forEach((id, index) => {
      column.set(id, index % cardsPerRow);
      row.set(id, nextRow + Math.floor(index / cardsPerRow));
    });
    nextRow += Math.ceil(layer.length / cardsPerRow);
  }
  return { row, column };
}

function chooseCardsPerRow(layerSizes: readonly number[], pitchRatio: number): number {
  const widest = Math.max(...layerSizes, MINIMUM_PORT_SPAN);
  let bestCount = widest;
  let bestDistance = Infinity;
  for (let cardsPerRow = MINIMUM_PORT_SPAN; cardsPerRow <= widest; cardsPerRow += CELL_STEP) {
    const rowCount = layerSizes.reduce((sum, size) => sum + Math.ceil(size / cardsPerRow), EMPTY_INDEX);
    const aspect = (cardsPerRow * pitchRatio) / rowCount;
    const distance = Math.abs(Math.log(aspect / PACKED_ASPECT_RATIO));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestCount = cardsPerRow;
    }
  }
  return bestCount;
}

function assignSpreadRows(
  ids: readonly string[],
  rank: Map<string, number>,
  order: Map<string, number>,
): Map<string, number> {
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

function groupIncomingByTarget(
  ids: readonly string[],
  edges: readonly FlowPlacementEdge[],
): Map<string, string[]> {
  const incoming = new Map<string, string[]>();
  for (const id of ids) incoming.set(id, []);
  for (const edge of edges) incoming.get(edge.target)?.push(edge.source);
  return incoming;
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

function buildNodeCards(nodes: readonly FlowPlacementNode[], grid: Grid): Map<string, Card> {
  const cards = new Map<string, Card>();
  for (const node of nodes) {
    const column = grid.column.get(node.id) ?? EMPTY_INDEX;
    const row = grid.row.get(node.id) ?? EMPTY_INDEX;
    cards.set(node.id, {
      id: node.id,
      x: column * (node.width + COLUMN_GAP),
      y: row * (node.height + ROW_GAP),
      width: node.width,
      height: node.height,
    });
  }
  return cards;
}

/**
 * `shouldTryEveryPort` lets a bent flow whose preferred L shapes still conflict try the
 * COARSE_PORT_SLOT_COUNT grid of ports, then the finer grid. Only the final drawing pays for it; the search scores
 * layouts with the two preferred L shapes.
 */
function buildFlowRoutes(layout: FlowLayout): Map<string, FlowPoint[]> {
  const { cards, edges, grid } = layout;
  const straightShift = assignStraightShifts(edges, cards, grid);
  const shifts = {
    straightShift,
    exitShift: assignExitShifts(edges, cards, grid),
    entryShift: assignEntryShifts({ edges, cards, grid, straightShift }),
  };
  const routes = new Map<string, FlowPoint[]>();
  const straightFirst = [...edges].sort(
    (left, right) => Number(!isStraightPair(left, grid)) - Number(!isStraightPair(right, grid)),
  );
  for (const edge of straightFirst) {
    const points = routeFlow({ edge, layout, shifts, drawnRoutes: routes });
    if (points) routes.set(edge.id, points);
  }
  return routes;
}

type FlowLayout = {
  cards: Map<string, Card>;
  edges: readonly FlowPlacementEdge[];
  grid: Grid;
  shouldTryEveryPort: boolean;
};

function routeFlow(flow: {
  edge: FlowPlacementEdge;
  layout: FlowLayout;
  shifts: { straightShift: Map<string, number>; exitShift: Map<string, number>; entryShift: Map<string, number> };
  drawnRoutes: Map<string, FlowPoint[]>;
}): FlowPoint[] | undefined {
  const { edge, layout, shifts, drawnRoutes } = flow;
  const { cards, edges, grid } = layout;
  const source = cards.get(edge.source);
  const target = cards.get(edge.target);
  if (!source || !target) return undefined;
  const candidates = listRouteCandidates({ edge, source, target, grid, edges, cards, ...shifts }).map(simplify);
  const preferred = pickFreestRoute({ edge, candidates, drawnRoutes, cards });
  if (!layout.shouldTryEveryPort || isStraightPair(edge, grid)) return preferred.points;
  const tryPorts = (current: ScoredRoute, slotCount: number) => {
    const variants = listPortVariants({ source, target, slotCount }).map(simplify);
    return pickFreestRoute({ edge, candidates: [current.points, ...variants], drawnRoutes, cards });
  };
  const coarse = hasConflict(preferred.score) ? tryPorts(preferred, COARSE_PORT_SLOT_COUNT) : preferred;
  return coarse.score.sharedStretches > 0 ? tryPorts(coarse, FINE_PORT_SLOT_COUNT).points : coarse.points;
}

type ScoredRoute = { points: FlowPoint[]; score: PlacementScore };

/** A crossing still reads with a hop, so only a stacked stretch or a hidden card pays for every port. */
function hasConflict(score: PlacementScore): boolean {
  return score.sharedStretches > 0 || score.cuts > 0;
}

/** The first candidate wins ties, so the other L shape is taken only when it is freer. */
function pickFreestRoute(pick: {
  edge: FlowPlacementEdge;
  candidates: FlowPoint[][];
  drawnRoutes: Map<string, FlowPoint[]>;
  cards: Map<string, Card>;
}): ScoredRoute {
  const scores = scoreCandidateRoutes(pick);
  const scored = pick.candidates.map((points, index) => ({ points, score: scores[index] as PlacementScore }));
  return scored.reduce((current, next) => (isScoreBetter(next.score, current.score) ? next : current));
}

function listRouteCandidates(choice: {
  edge: FlowPlacementEdge;
  source: Card;
  target: Card;
  grid: Grid;
  edges: readonly FlowPlacementEdge[];
  cards: Map<string, Card>;
  straightShift: Map<string, number>;
  exitShift: Map<string, number>;
  entryShift: Map<string, number>;
}): FlowPoint[][] {
  const { edge, source, target, grid, edges, cards, straightShift, exitShift, entryShift } = choice;
  const laneShift = straightShift.get(edge.id) ?? SINGLE_LANE_SHIFT;
  if (isVerticalStraight(edge, grid)) return [buildVerticalRoute(source, target, laneShift)];
  if (isHorizontalStraight(edge, grid)) return [buildHorizontalRoute(source, target, laneShift)];
  const sideEntry = buildSideEntryRoute(source, target, {
    xShift: SINGLE_LANE_SHIFT,
    yShift: exitShift.get(edge.id) ?? SINGLE_LANE_SHIFT,
  });
  const elbow = buildElbowRoute(source, target, {
    yShift: exitShift.get(edge.id) ?? SINGLE_LANE_SHIFT,
    xShift: entryShift.get(edge.id) ?? SINGLE_LANE_SHIFT,
  });
  return shouldEnterFromSide(edge, { edges, cards, grid, straightShift }) ? [sideEntry, elbow] : [elbow, sideEntry];
}

/** Both L shapes through every pair of `slotCount` exit and entry ports. */
function listPortVariants(ports: { source: Card; target: Card; slotCount: number }): FlowPoint[][] {
  const { source, target, slotCount } = ports;
  const elbows = pairSlots(calculateLaneShifts(slotCount, source.height), calculateLaneShifts(slotCount, target.width))
    .map(([yShift, xShift]) => buildElbowRoute(source, target, { yShift, xShift }));
  const sideEntries = pairSlots(calculateLaneShifts(slotCount, source.width), calculateLaneShifts(slotCount, target.height))
    .map(([xShift, yShift]) => buildSideEntryRoute(source, target, { xShift, yShift }));
  return [...elbows, ...sideEntries];
}

function pairSlots(first: readonly number[], second: readonly number[]): [number, number][] {
  return first.flatMap((left) => second.map((right): [number, number] => [left, right]));
}

function assignStraightShifts(
  edges: readonly FlowPlacementEdge[],
  cards: Map<string, Card>,
  grid: Grid,
): Map<string, number> {
  const shifts = new Map<string, number>();
  writeStraightLanes({
    edges: edges.filter((edge) => isVerticalStraight(edge, grid)),
    cards,
    shifts,
    isVertical: true,
    readLineKey: (edge) => String(grid.column.get(edge.source) ?? EMPTY_INDEX),
  });
  writeStraightLanes({
    edges: edges.filter((edge) => isHorizontalStraight(edge, grid)),
    cards,
    shifts,
    isVertical: false,
    readLineKey: (edge) => String(grid.row.get(edge.source) ?? EMPTY_INDEX),
  });
  return shifts;
}

function writeStraightLanes(lanes: {
  edges: readonly FlowPlacementEdge[];
  cards: Map<string, Card>;
  shifts: Map<string, number>;
  isVertical: boolean;
  readLineKey: (edge: FlowPlacementEdge) => string;
}): void {
  const { edges, cards, shifts, isVertical, readLineKey } = lanes;
  const readSpan = (edge: FlowPlacementEdge) =>
    isVertical ? readVerticalSpan(edge, cards) : readHorizontalSpan(edge, cards);
  for (const list of groupEdges(edges, readLineKey).values()) {
    const packed = packLanes(list, readSpan);
    const firstSource = list[EMPTY_INDEX] ? cards.get(list[EMPTY_INDEX].source) : undefined;
    if (!firstSource) continue;
    const offsets = calculateLaneShifts(packed.length, isVertical ? firstSource.width : firstSource.height);
    packed.forEach((members, index) => {
      for (const edge of members) shifts.set(edge.id, offsets[index] ?? SINGLE_LANE_SHIFT);
    });
  }
}

function packLanes(
  edges: readonly FlowPlacementEdge[],
  readSpan: (edge: FlowPlacementEdge) => Span | undefined,
): FlowPlacementEdge[][] {
  const lanes: FlowPlacementEdge[][] = [];
  const readLow = (edge: FlowPlacementEdge) => readSpan(edge)?.low ?? 0;
  const ordered = [...edges].sort((left, right) => readLow(left) - readLow(right));
  for (const edge of ordered) {
    const openLane = lanes.find((members) => members.every((other) => !isSpanOverlapping(readSpan(edge), readSpan(other))));
    if (openLane) openLane.push(edge);
    else lanes.push([edge]);
  }
  return lanes;
}

function assignExitShifts(
  edges: readonly FlowPlacementEdge[],
  cards: Map<string, Card>,
  grid: Grid,
): Map<string, number> {
  const shifts = new Map<string, number>();
  const bySource = groupEdges(edges.filter((edge) => !isStraightPair(edge, grid)), (edge) => edge.source);
  for (const [sourceId, list] of bySource) {
    const source = cards.get(sourceId);
    if (!source) continue;
    const below = list.filter((edge) => isTargetBelow(source, cards.get(edge.target)));
    const above = list.filter((edge) => !isTargetBelow(source, cards.get(edge.target)));
    const offsets = calculateLaneShifts(list.length, source.height);
    writeExitOrder({ edges: above, offsets: offsets.slice(0, above.length), source, cards, shifts, isBelow: false });
    writeExitOrder({ edges: below, offsets: offsets.slice(above.length), source, cards, shifts, isBelow: true });
  }
  return shifts;
}

/**
 * Flows going up share the upper ports and flows going down the lower ones, so no two
 * leave from one point. The nearest target gets the outermost port, so the elbows nest.
 */
function writeExitOrder(order: {
  edges: readonly FlowPlacementEdge[];
  offsets: readonly number[];
  source: Card;
  cards: Map<string, Card>;
  shifts: Map<string, number>;
  isBelow: boolean;
}): void {
  const { edges, offsets, source, cards, shifts, isBelow } = order;
  const nearestFirst = [...edges].sort(
    (left, right) => measureHorizontalDistance(source, cards.get(left.target)) - measureHorizontalDistance(source, cards.get(right.target)),
  );
  const lastIndex = offsets.length - 1;
  nearestFirst.forEach((edge, index) => {
    const shift = isBelow ? offsets[lastIndex - index] : offsets[index];
    shifts.set(edge.id, shift ?? SINGLE_LANE_SHIFT);
  });
}

function assignEntryShifts(layout: {
  edges: readonly FlowPlacementEdge[];
  cards: Map<string, Card>;
  grid: Grid;
  straightShift: Map<string, number>;
}): Map<string, number> {
  const { edges, cards, grid, straightShift } = layout;
  const shifts = new Map<string, number>();
  const bent = edges.filter((edge) => !isStraightPair(edge, grid));
  const byTarget = groupEdges(bent, (edge) => edge.target);
  for (const [targetId, list] of byTarget) {
    const target = cards.get(targetId);
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
  cards: Map<string, Card>;
  grid: Grid;
  straightShift: Map<string, number>;
};

function isSourceLaneOpen(edge: FlowPlacementEdge, context: RouteContext): boolean {
  const source = context.cards.get(edge.source);
  const target = context.cards.get(edge.target);
  if (!source || !target) return false;
  const laneX = readCenterX(source);
  const startY = source.y <= target.y ? source.y + source.height : source.y;
  const endY = target.y + target.height * CENTER_RATIO;
  const laneSpan = buildSpan(startY, endY);
  const sourceColumn = context.grid.column.get(edge.source);
  return context.edges.every((other) => {
    const isStraightInSourceColumn = isVerticalStraight(other, context.grid)
      && context.grid.column.get(other.source) === sourceColumn;
    if (!isStraightInSourceColumn) return true;
    const otherSource = context.cards.get(other.source);
    if (!otherSource) return true;
    const otherX = readCenterX(otherSource) + (context.straightShift.get(other.id) ?? SINGLE_LANE_SHIFT);
    if (Math.abs(otherX - laneX) > POINT_MATCH_DISTANCE) return true;
    return !isSpanOverlapping(readVerticalSpan(other, context.cards), laneSpan);
  });
}

function buildSideEntryRoute(source: Card, target: Card, shifts: { xShift: number; yShift: number }): FlowPoint[] {
  const { xShift, yShift } = shifts;
  const isSourceAbove = source.y <= target.y;
  const isTargetRight = readCenterX(target) >= readCenterX(source);
  const sourceX = clamp(readCenterX(source) + xShift, source.x + PORT_MARGIN, source.x + source.width - PORT_MARGIN);
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

/** `count` lanes split the usable border into `count + 1` equal gaps, centered on the card. */
function calculateLaneShifts(count: number, span: number): number[] {
  if (count <= SINGLE_LANE_COUNT) return [SINGLE_LANE_SHIFT];
  const usable = Math.max(span - PORT_MARGIN * BORDER_SIDES, MINIMUM_PORT_SPAN);
  const gapCount = count + 1;
  return Array.from({ length: count }, (_, index) => ((index + 1) / gapCount - CENTER_RATIO) * usable);
}

function groupEdges(
  edges: readonly FlowPlacementEdge[],
  readGroupKey: (edge: FlowPlacementEdge) => string,
): Map<string, FlowPlacementEdge[]> {
  const groups = new Map<string, FlowPlacementEdge[]>();
  for (const edge of edges) {
    const key = readGroupKey(edge);
    const list = groups.get(key) ?? [];
    list.push(edge);
    groups.set(key, list);
  }
  return groups;
}

function readCenterX(card: Card): number {
  return card.x + card.width * CENTER_RATIO;
}

function readVerticalSpan(edge: FlowPlacementEdge, cards: Map<string, Card>): Span | undefined {
  const source = cards.get(edge.source);
  const target = cards.get(edge.target);
  if (!source || !target) return undefined;
  const isSourceAbove = source.y <= target.y;
  const start = isSourceAbove ? source.y + source.height : source.y;
  const end = isSourceAbove ? target.y : target.y + target.height;
  return buildSpan(start, end);
}

function readHorizontalSpan(edge: FlowPlacementEdge, cards: Map<string, Card>): Span | undefined {
  const source = cards.get(edge.source);
  const target = cards.get(edge.target);
  if (!source || !target) return undefined;
  const isSourceLeft = source.x <= target.x;
  const start = isSourceLeft ? source.x + source.width : source.x;
  const end = isSourceLeft ? target.x : target.x + target.width;
  return buildSpan(start, end);
}

function isTargetBelow(source: Card, target: Card | undefined): boolean {
  if (!target) return true;
  return target.y + target.height * CENTER_RATIO >= source.y + source.height * CENTER_RATIO;
}

function measureHorizontalDistance(source: Card, target: Card | undefined): number {
  if (!target) return 0;
  return Math.abs(readCenterX(target) - readCenterX(source));
}

function collectReservedEntryPositions(entry: {
  target: Card;
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

function buildVerticalRoute(source: Card, target: Card, shift: number): FlowPoint[] {
  const x = source.x + source.width * CENTER_RATIO + shift;
  const isSourceAbove = source.y <= target.y;
  return [
    { x, y: isSourceAbove ? source.y + source.height : source.y },
    { x, y: isSourceAbove ? target.y : target.y + target.height },
  ];
}

function buildHorizontalRoute(source: Card, target: Card, shift: number): FlowPoint[] {
  const y = source.y + source.height * CENTER_RATIO + shift;
  const isSourceLeft = source.x <= target.x;
  return [
    { x: isSourceLeft ? source.x + source.width : source.x, y },
    { x: isSourceLeft ? target.x : target.x + target.width, y },
  ];
}

function buildElbowRoute(
  source: Card,
  target: Card,
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
    for (const rightId of ids.slice(leftIndex + 1)) {
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

/** Spends one score from the budget, so it reports false once the budget is gone. */
function isMoveBetter(search: PlacementSearch, current: PlacementScore): boolean {
  if (search.remainingScores <= 0) return false;
  search.remainingScores -= 1;
  return isScoreBetter(scoreGrid(search), current);
}

function scoreGrid(search: PlacementSearch): PlacementScore {
  const cards = buildNodeCards(search.nodes, search.grid);
  const routes = buildFlowRoutes({ cards, edges: search.edges, grid: search.grid, shouldTryEveryPort: false });
  return scoreRoutes({ routes, cards, edges: search.edges });
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

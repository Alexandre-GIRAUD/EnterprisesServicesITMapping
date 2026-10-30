import type { Node } from '@xyflow/react';
import type { Point } from './elkLayout';

/** Invisible margin between disconnected graph zones (flow-coordinate px). */
export const COMPONENT_GAP = 140;

type Pos = { x: number; y: number };
type Size = { width: number; height: number };

/**
 * Partition node ids into connected components (undirected). Isolated nodes each
 * form their own single-node component.
 */
export function findConnectedComponents(
  nodeIds: readonly string[],
  edges: readonly { source: string; target: string }[]
): string[][] {
  const adj = new Map<string, Set<string>>();
  for (const id of nodeIds) adj.set(id, new Set());
  for (const e of edges) {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  }

  const seen = new Set<string>();
  const components: string[][] = [];
  for (const id of nodeIds) {
    if (seen.has(id)) continue;
    const comp: string[] = [];
    const stack = [id];
    seen.add(id);
    while (stack.length) {
      const cur = stack.pop()!;
      comp.push(cur);
      for (const nb of adj.get(cur) ?? []) {
        if (!seen.has(nb)) {
          seen.add(nb);
          stack.push(nb);
        }
      }
    }
    components.push(comp);
  }
  return components;
}

function nodeSize(node: Node | undefined, nodeWidth: number, nodeHeight: number): Size {
  return {
    width: node?.width ?? nodeWidth,
    height: node?.height ?? nodeHeight,
  };
}

/** Shift positions so the component bounding box starts at (0, 0). */
export function normalizeComponentLayout(
  nodeIds: string[],
  positions: Map<string, Pos>,
  routes: Map<string, Point[]>,
  nodes: Node[],
  nodeWidth: number,
  nodeHeight: number
): Size {
  let minX = Infinity;
  let minY = Infinity;
  for (const id of nodeIds) {
    const p = positions.get(id);
    if (!p) continue;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
  }
  if (!Number.isFinite(minX)) minX = 0;
  if (!Number.isFinite(minY)) minY = 0;

  const dx = -minX;
  const dy = -minY;
  if (dx !== 0 || dy !== 0) {
    for (const id of nodeIds) {
      const p = positions.get(id);
      if (p) positions.set(id, { x: p.x + dx, y: p.y + dy });
    }
    for (const [edgeId, route] of routes) {
      routes.set(
        edgeId,
        route.map((pt) => ({ x: pt.x + dx, y: pt.y + dy }))
      );
    }
  }

  let maxX = 0;
  let maxY = 0;
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  for (const id of nodeIds) {
    const p = positions.get(id);
    if (!p) continue;
    const { width, height } = nodeSize(nodeById.get(id), nodeWidth, nodeHeight);
    maxX = Math.max(maxX, p.x + width);
    maxY = Math.max(maxY, p.y + height);
  }
  return { width: maxX, height: maxY };
}

/**
 * Same ratio as `FIT_VIEW_PADDING` in fitGraphView. Duplicated so this module
 * does not import the fitter (that import would cycle through the layout).
 */
const FIT_PADDING = 0.15;

/** Frames stay apart even when the fit margin is smaller than the zone padding. */
const MIN_ISLAND_GAP = 8;

/** Row widths tried when packing islands for the fit-to-view zoom. */
const SHELF_LIMIT_STEPS = 40;

type IndexedSize = Size & { i: number; area: number };

/**
 * Top-left of each island's nodes. Two or more islands are packed so their
 * dashed frames do not touch and the gap matches the default fit margin.
 * One island stays at (0, 0).
 */
export function packComponentOffsets(
  bounds: Size[],
  gap: number = COMPONENT_GAP,
  aspectRatio?: number
): Pos[] {
  if (bounds.length === 0) return [];
  if (bounds.length === 1) return [{ x: 0, y: 0 }];
  if (!aspectRatio || aspectRatio <= 0) return shelfPack(bounds, gap);

  const items = bounds
    .map((bound, i) => ({ ...bound, i, area: bound.width * bound.height }))
    .sort((a, b) => b.height - a.height || b.width - a.width || a.i - b.i);

  let bestFit = -Infinity;
  let best: Pos[] = shelfPack(bounds, gap);
  for (const limit of shelfWidthLimits(items)) {
    const rows = shelvesOf(items, limit);
    const gapSize = gapMatchingFit(rows, aspectRatio);
    const fit = fitZoom(rows, gapSize, aspectRatio);
    if (fit > bestFit) {
      bestFit = fit;
      best = placeRows(rows, gapSize);
    }
  }
  return best;
}

/** Row widths to try, from the widest island alone up to every island on one row. */
function shelfWidthLimits(items: IndexedSize[]): number[] {
  const framed = items.map((item) => item.width + 2 * ZONE_PADDING);
  const widest = Math.max(...framed);
  const total = framed.reduce((sum, width) => sum + width, 0) + MIN_ISLAND_GAP * (items.length - 1);
  return Array.from({ length: SHELF_LIMIT_STEPS + 1 }, (_, k) => widest + ((total - widest) * k) / SHELF_LIMIT_STEPS);
}

/** Fill rows left to right, tallest island first, starting a row when the next island would not fit. */
function shelvesOf(items: IndexedSize[], limit: number): IndexedSize[][] {
  const rows: IndexedSize[][] = [];
  let used = 0;
  for (const item of items) {
    const width = item.width + 2 * ZONE_PADDING;
    const row = rows[rows.length - 1];
    if (row && used + MIN_ISLAND_GAP + width <= limit) {
      row.push(item);
      used += MIN_ISLAND_GAP + width;
    } else {
      rows.push([item]);
      used = width;
    }
  }
  return rows;
}

/** Zoom the whole drawing gets when fitted in a pane of the given aspect ratio (height 1). */
function fitZoom(rows: IndexedSize[][], gap: number, aspectRatio: number): number {
  const { spanX, gapsX, spanY, gapsY } = rowSpans(rows);
  const width = spanX + gapsX * (2 * ZONE_PADDING + gap);
  const height = spanY + gapsY * (2 * ZONE_PADDING + gap);
  return Math.min(aspectRatio / width, 1 / height);
}

function gapMatchingFit(rows: IndexedSize[][], aspectRatio: number): number {
  const { spanX, gapsX, spanY, gapsY } = rowSpans(rows);
  const paddingRatio = FIT_PADDING / (1 - 2 * FIT_PADDING);
  const seedW = spanX + gapsX * (2 * ZONE_PADDING + MIN_ISLAND_GAP);
  const seedH = spanY + gapsY * (2 * ZONE_PADDING + MIN_ISLAND_GAP);
  const widthLimits = seedH <= 0 || seedW / seedH >= aspectRatio;
  const span = widthLimits ? spanX : spanY;
  const gaps = widthLimits ? gapsX : gapsY;
  if (gaps === 0) return MIN_ISLAND_GAP;
  // ponytail: more gaps than the fit padding can absorb has no finite equal margin.
  // Keep the minimum gap so a large graph still fits on screen.
  const denom = 1 - paddingRatio * gaps;
  if (denom <= 0.25) return MIN_ISLAND_GAP;
  const solved = (paddingRatio * span + ZONE_PADDING * (2 * paddingRatio * gaps - 1)) / denom;
  const cap = span / gaps;
  return Math.min(cap, Math.max(MIN_ISLAND_GAP, solved));
}

function rowSpans(rows: IndexedSize[][]) {
  let spanX = 0;
  let gapsX = 0;
  let spanY = 0;
  for (const row of rows) {
    spanX = Math.max(spanX, row.reduce((sum, item) => sum + item.width, 0));
    gapsX = Math.max(gapsX, Math.max(0, row.length - 1));
    spanY += row.reduce((max, item) => Math.max(max, item.height), 0);
  }
  return { spanX, gapsX, spanY, gapsY: Math.max(0, rows.length - 1) };
}

function placeRows(rows: IndexedSize[][], gap: number): Pos[] {
  const offsets: Pos[] = [];
  let y = 0;
  for (const row of rows) {
    let x = 0;
    let rowHeight = 0;
    for (const item of row) {
      offsets[item.i] = { x: x + ZONE_PADDING, y: y + ZONE_PADDING };
      x += item.width + 2 * ZONE_PADDING + gap;
      rowHeight = Math.max(rowHeight, item.height + 2 * ZONE_PADDING);
    }
    y += rowHeight + gap;
  }
  return offsets;
}

function shelfPack(bounds: Size[], gap: number): Pos[] {
  const indexed = bounds.map((bound, i) => ({ ...bound, i, area: bound.width * bound.height }));
  indexed.sort((a, b) => b.area - a.area || a.i - b.i);
  const rowWidth = bounds.reduce((sum, bound) => sum + bound.width, 0) + gap * (bounds.length - 1);
  const offsets: Pos[] = [];
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  for (const item of indexed) {
    if (x > 0 && x + item.width > rowWidth) {
      x = 0;
      y += rowHeight + gap;
      rowHeight = 0;
    }
    offsets[item.i] = { x, y };
    x += item.width + gap;
    rowHeight = Math.max(rowHeight, item.height);
  }
  return offsets;
}

/** Gap between a diagram's nodes and its dashed zone. */
export const ZONE_PADDING = 28;

const FALLBACK_NODE_WIDTH = 160;
const FALLBACK_NODE_HEIGHT = 48;

export type ZoneFrame = { x: number; y: number; width: number; height: number };

type ZoneNode = {
  id: string;
  position: { x: number; y: number };
  width?: number | null;
  height?: number | null;
};

/** One padded frame per disconnected diagram. A single diagram returns none. */
export function componentZoneFrames(
  nodes: readonly ZoneNode[],
  edges: readonly { source: string; target: string }[],
  padding: number = ZONE_PADDING,
): ZoneFrame[] {
  const components = findConnectedComponents(
    nodes.map((node) => node.id),
    edges,
  );
  if (components.length < 2) return [];

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  return components.map((ids) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const id of ids) {
      const node = nodeById.get(id);
      if (!node) continue;
      const width = node.width ?? FALLBACK_NODE_WIDTH;
      const height = node.height ?? FALLBACK_NODE_HEIGHT;
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + width);
      maxY = Math.max(maxY, node.position.y + height);
    }
    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    };
  });
}

/** Apply a translation to every node position and route point in a component. */
export function translateComponentLayout(
  nodeIds: string[],
  positions: Map<string, Pos>,
  routes: Map<string, Point[]>,
  edgeIds: string[],
  offset: Pos
): void {
  if (offset.x === 0 && offset.y === 0) return;
  for (const id of nodeIds) {
    const p = positions.get(id);
    if (p) positions.set(id, { x: p.x + offset.x, y: p.y + offset.y });
  }
  for (const edgeId of edgeIds) {
    const route = routes.get(edgeId);
    if (!route) continue;
    routes.set(
      edgeId,
      route.map((pt) => ({ x: pt.x + offset.x, y: pt.y + offset.y }))
    );
  }
}

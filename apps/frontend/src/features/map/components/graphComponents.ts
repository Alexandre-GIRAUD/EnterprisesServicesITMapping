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

  const items = bounds.map((bound, i) => ({ ...bound, i, area: bound.width * bound.height }));
  items.sort((a, b) => b.area - a.area || a.i - b.i);
  const narrowest = Math.min(...bounds.map((bound) => bound.width));

  let bestScore = Infinity;
  let best: Pos[] = shelfPack(bounds, gap);
  for (let columns = 1; columns <= items.length; columns += 1) {
    const rows = rowsOf(items, columns);
    const gapSize = gapMatchingFit(rows, aspectRatio);
    const placed = placeRows(rows, gapSize);
    const score = arrangementScore(rows, gapSize, aspectRatio, narrowest);
    if (score < bestScore) {
      bestScore = score;
      best = placed;
    }
  }
  return best;
}

function rowsOf(items: IndexedSize[], columns: number): IndexedSize[][] {
  const rows: IndexedSize[][] = [];
  for (const item of items) {
    const row = rows[rows.length - 1];
    if (!row || row.length >= columns) rows.push([item]);
    else row.push(item);
  }
  return rows;
}

function gapMatchingFit(rows: IndexedSize[][], aspectRatio: number): number {
  const { spanX, gapsX, spanY, gapsY } = rowSpans(rows);
  const paddingRatio = FIT_PADDING / (1 - 2 * FIT_PADDING);
  let gap = MIN_ISLAND_GAP;
  for (let step = 0; step < 8; step += 1) {
    const nodeW = spanX + gapsX * (2 * ZONE_PADDING + gap);
    const nodeH = spanY + gapsY * (2 * ZONE_PADDING + gap);
    const widthLimits = nodeH <= 0 || nodeW / nodeH >= aspectRatio;
    const span = widthLimits ? nodeW : nodeH;
    gap = Math.max(MIN_ISLAND_GAP, paddingRatio * span - ZONE_PADDING);
  }
  return gap;
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

function arrangementScore(
  rows: IndexedSize[][],
  gap: number,
  aspectRatio: number,
  narrowest: number,
): number {
  const { spanX, gapsX, spanY, gapsY } = rowSpans(rows);
  const nodeW = spanX + gapsX * (2 * ZONE_PADDING + gap);
  const nodeH = spanY + gapsY * (2 * ZONE_PADDING + gap);
  const aspect = nodeH > 0 ? nodeW / nodeH : aspectRatio;
  let score = Math.abs(Math.log(aspect / aspectRatio));
  const fullSpan = spanX + gapsX * (2 * ZONE_PADDING + gap);
  for (const row of rows) {
    const rowSpan =
      row.reduce((sum, item) => sum + item.width, 0) +
      Math.max(0, row.length - 1) * (2 * ZONE_PADDING + gap);
    if (fullSpan - rowSpan > narrowest) score += 10;
  }
  return score;
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

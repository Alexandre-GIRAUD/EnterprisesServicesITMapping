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
 * Compute top-left offsets that place each component in its own zone. Components
 * are packed row-by-row with {@link COMPONENT_GAP} between zones; row width
 * adapts to the viewport aspect ratio when provided.
 */
export function packComponentOffsets(
  bounds: Size[],
  gap: number = COMPONENT_GAP,
  aspectRatio?: number
): Pos[] {
  if (bounds.length === 0) return [];
  if (bounds.length === 1) return [{ x: 0, y: 0 }];

  const indexed = bounds.map((b, i) => ({ i, area: b.width * b.height, ...b }));
  indexed.sort((a, b) => b.area - a.area);

  const totalArea = bounds.reduce((sum, b) => sum + b.width * b.height, 0);
  const rowWidth =
    aspectRatio && aspectRatio > 0
      ? Math.max(...bounds.map((b) => b.width), Math.sqrt(totalArea * aspectRatio))
      : bounds.reduce((sum, b) => sum + b.width, 0) + gap * (bounds.length - 1);

  const offsets: Pos[] = new Array(bounds.length);
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

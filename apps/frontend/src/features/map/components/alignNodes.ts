import type { Edge, Node } from '@xyflow/react';
import { buildLiveRoutes, type Point, type Rect } from './elkLayout';

export type AlignOptions = {
  nodeWidth?: number;
  nodeHeight?: number;
  maxPasses?: number;
};

type Pos = { x: number; y: number };

function nodeSize(node: Node, nodeWidth: number, nodeHeight: number) {
  return {
    width: node.width ?? nodeWidth,
    height: node.height ?? nodeHeight,
  };
}

function buildRectMap(
  nodes: Node[],
  positions: Map<string, Pos>,
  nodeWidth: number,
  nodeHeight: number
): Map<string, Rect> {
  const rects = new Map<string, Rect>();
  for (const node of nodes) {
    const pos = positions.get(node.id);
    if (!pos) continue;
    const { width, height } = nodeSize(node, nodeWidth, nodeHeight);
    rects.set(node.id, { x: pos.x, y: pos.y, width, height });
  }
  return rects;
}

function rectsOverlap(a: Rect, b: Rect, margin = 4): boolean {
  return !(
    a.x + a.width + margin <= b.x ||
    b.x + b.width + margin <= a.x ||
    a.y + a.height + margin <= b.y ||
    b.y + b.height + margin <= a.y
  );
}

function hasOverlap(nodeId: string, rectById: Map<string, Rect>): boolean {
  const rect = rectById.get(nodeId);
  if (!rect) return false;
  for (const [id, other] of rectById) {
    if (id === nodeId) continue;
    if (rectsOverlap(rect, other)) return true;
  }
  return false;
}

function countBends(routes: Map<string, Point[]>): number {
  let total = 0;
  for (const route of routes.values()) {
    total += Math.max(0, route.length - 2);
  }
  return total;
}

function scorePositions(
  positions: Map<string, Pos>,
  nodes: Node[],
  edges: { id: string; source: string; target: string }[],
  nodeWidth: number,
  nodeHeight: number
): number {
  const rectById = buildRectMap(nodes, positions, nodeWidth, nodeHeight);
  const routes = buildLiveRoutes(edges, rectById);
  return countBends(routes);
}

function neighborsOf(nodeId: string, edges: Edge[]): string[] {
  const out = new Set<string>();
  for (const e of edges) {
    if (e.source === nodeId) out.add(e.target);
    if (e.target === nodeId) out.add(e.source);
  }
  return [...out];
}

/** Snap `node` center on `axis` to the center of `neighbor`. */
function alignCenter(
  node: Node,
  pos: Pos,
  neighborPos: Pos,
  neighbor: Node,
  axis: 'x' | 'y' | 'both',
  nodeWidth: number,
  nodeHeight: number
): Pos {
  const { width: nw, height: nh } = nodeSize(node, nodeWidth, nodeHeight);
  const { width: mw, height: mh } = nodeSize(neighbor, nodeWidth, nodeHeight);
  const next = { ...pos };
  if (axis === 'x' || axis === 'both') {
    const neighborCx = neighborPos.x + mw / 2;
    next.x = neighborCx - nw / 2;
  }
  if (axis === 'y' || axis === 'both') {
    const neighborCy = neighborPos.y + mh / 2;
    next.y = neighborCy - nh / 2;
  }
  return next;
}

type Axis = 'x' | 'y' | 'both';

function alignmentCandidates(
  node: Node,
  pos: Pos,
  neighbor: Node,
  neighborPos: Pos,
  nodeWidth: number,
  nodeHeight: number
): Pos[] {
  const axes: Axis[] = ['x', 'y', 'both'];
  return axes.map((axis) =>
    alignCenter(node, pos, neighborPos, neighbor, axis, nodeWidth, nodeHeight)
  );
}

function findBestAlignmentMove(
  positions: Map<string, Pos>,
  nodes: Node[],
  edges: Edge[],
  nodeWidth: number,
  nodeHeight: number,
  restrictToNodeId?: string
): { nodeId: string; pos: Pos; score: number } | null {
  const edgeList = edges.map((e) => ({ id: e.id, source: e.source, target: e.target }));
  const baseline = scorePositions(positions, nodes, edgeList, nodeWidth, nodeHeight);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  let best: { nodeId: string; pos: Pos; score: number } | null = null;

  for (const node of nodes) {
    if (restrictToNodeId && node.id !== restrictToNodeId) continue;
    const current = positions.get(node.id);
    if (!current) continue;

    for (const neighborId of neighborsOf(node.id, edges)) {
      const neighbor = nodeById.get(neighborId);
      const neighborPos = positions.get(neighborId);
      if (!neighbor || !neighborPos) continue;

      for (const candidatePos of alignmentCandidates(
        node,
        current,
        neighbor,
        neighborPos,
        nodeWidth,
        nodeHeight
      )) {
        if (candidatePos.x === current.x && candidatePos.y === current.y) continue;

        const trial = new Map(positions);
        trial.set(node.id, candidatePos);
        const rectById = buildRectMap(nodes, trial, nodeWidth, nodeHeight);
        if (hasOverlap(node.id, rectById)) continue;

        const score = scorePositions(trial, nodes, edgeList, nodeWidth, nodeHeight);
        if (score >= baseline) continue;
        if (!best || score < best.score) {
          best = { nodeId: node.id, pos: candidatePos, score };
        }
      }
    }
  }

  return best;
}

/**
 * Iteratively align node centers with neighbors when doing so reduces the total
 * number of bends across all edges. Used after ELK/Dagre layout.
 */
export function alignPositionsForStraighterEdges(
  positions: Map<string, Pos>,
  nodes: Node[],
  edges: Edge[],
  options: AlignOptions = {}
): Map<string, Pos> {
  const { nodeWidth = 160, nodeHeight = 48, maxPasses = 10 } = options;
  const result = new Map(positions);

  for (let pass = 0; pass < maxPasses; pass++) {
    const move = findBestAlignmentMove(result, nodes, edges, nodeWidth, nodeHeight);
    if (!move) break;
    result.set(move.nodeId, move.pos);
  }

  return result;
}

/**
 * After a drag ends, snap the moved node onto a neighbor axis when that reduces
 * bends on incident edges.
 */
export function snapDraggedNodeForStraighterEdges(
  draggedId: string,
  nodes: Node[],
  edges: Edge[],
  options: AlignOptions = {}
): Pos | null {
  const { nodeWidth = 160, nodeHeight = 48 } = options;
  const positions = new Map(nodes.map((n) => [n.id, { ...n.position }]));
  const move = findBestAlignmentMove(
    positions,
    nodes,
    edges,
    nodeWidth,
    nodeHeight,
    draggedId
  );
  return move?.pos ?? null;
}

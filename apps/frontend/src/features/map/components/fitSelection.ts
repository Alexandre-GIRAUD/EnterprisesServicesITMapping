import { findConnectedComponents } from './graphComponents';

/** Same box as the application card. Kept here so this file stays free of the data hook. */
const NODE_WIDTH = 160;
const NODE_HEIGHT = 48;

const WIDE_ASPECT_SLACK = 1.2;

/**
 * A short row cannot fill a tall pane without cropping a node.
 * ponytail: window is at least two nodes wide; a density grid if clusters overlap in x.
 */
const MIN_FOCUS_WIDTH = NODE_WIDTH * 2;

type FitNode = {
  id: string;
  position: { x: number; y: number };
  measured?: { width?: number; height?: number };
  width?: number;
  height?: number;
};

type Bounds = { x: number; y: number; width: number; height: number };

export function nodesForHeightFit<T extends FitNode>(
  nodes: readonly T[],
  viewport: { width: number; height: number },
  edges: readonly { source: string; target: string }[] = [],
): T[] {
  if (nodes.length <= 1) return [...nodes];
  const viewAspect = viewport.width / Math.max(viewport.height, 1);
  const all = boundsOf(nodes);
  const graphAspect = all.width / Math.max(all.height, 1);
  if (graphAspect <= viewAspect * WIDE_ASPECT_SLACK) return [...nodes];

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const groups = findConnectedComponents(
    nodes.map((node) => node.id),
    edges,
  )
    .map((ids) => ids.map((id) => byId.get(id)).filter((node): node is T => node != null))
    .filter((group) => group.length > 0);
  const best = groups.reduce((winner, group) => {
    if (!winner) return group;
    if (group.length !== winner.length) return group.length > winner.length ? group : winner;
    const groupArea = boundsOf(group).width * boundsOf(group).height;
    const winnerArea = boundsOf(winner).width * boundsOf(winner).height;
    return groupArea < winnerArea ? group : winner;
  }, null as T[] | null);
  if (!best) return [...nodes];

  const box = boundsOf(best);
  const focusWidth = Math.max(MIN_FOCUS_WIDTH, box.height * viewAspect);
  if (box.width <= focusWidth) return best;
  return densestSlice(best, box, focusWidth);
}

function densestSlice<T extends FitNode>(nodes: readonly T[], box: Bounds, focusWidth: number): T[] {
  const width = Math.min(box.width, focusWidth);
  const step = Math.max(NODE_WIDTH / 2, width / 6);
  let best = nodes;
  let bestCount = -1;
  for (let x = box.x; x <= box.x + box.width - width + step; x += step) {
    const inside = nodes.filter((node) => {
      const size = nodeSize(node);
      const center = node.position.x + size.width / 2;
      return center >= x && center <= x + width;
    });
    if (inside.length > bestCount) {
      bestCount = inside.length;
      best = inside;
    }
  }
  return best.length > 0 ? [...best] : [...nodes];
}

function boundsOf(nodes: readonly FitNode[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    const size = nodeSize(node);
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + size.width);
    maxY = Math.max(maxY, node.position.y + size.height);
  }
  return { x: minX, y: minY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) };
}

function nodeSize(node: FitNode): { width: number; height: number } {
  return {
    width: node.measured?.width ?? node.width ?? NODE_WIDTH,
    height: node.measured?.height ?? node.height ?? NODE_HEIGHT,
  };
}

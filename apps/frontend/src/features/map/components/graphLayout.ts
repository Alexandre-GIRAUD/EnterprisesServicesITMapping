import Dagre from '@dagrejs/dagre';
import { type Edge, type Node } from '@xyflow/react';

export type LayoutOptions = {
  nodeWidth?: number;
  nodeHeight?: number;
  nodeSeparation?: number;
  rankSeparation?: number;
  snapGrid?: number;
  aspectRatio?: number;
};

function snap(value: number, grid: number): number {
  return grid > 0 ? Math.round(value / grid) * grid : value;
}

export function layoutGraph<N extends Node>(
  nodes: N[],
  edges: Edge[],
  options: LayoutOptions = {}
): N[] {
  const {
    nodeWidth = 140,
    nodeHeight = 48,
    nodeSeparation = 90,
    rankSeparation = 120,
    snapGrid = 0,
    aspectRatio,
  } = options;

  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'TB',
    ranker: 'network-simplex',
    align: 'UL',
    nodesep: nodeSeparation,
    ranksep: rankSeparation,
    edgesep: 16,
    marginx: 28,
    marginy: 28,
  });

  for (const node of nodes) {
    g.setNode(node.id, {
      width: node.width ?? nodeWidth,
      height: node.height ?? nodeHeight,
    });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  Dagre.layout(g);

  const sizeOf = (node: N) => ({
    width: node.width ?? nodeWidth,
    height: node.height ?? nodeHeight,
  });

  let minCx = Infinity;
  let minCy = Infinity;
  let minLeft = Infinity;
  let maxRight = -Infinity;
  let minTop = Infinity;
  let maxBottom = -Infinity;
  for (const node of nodes) {
    const { x, y } = g.node(node.id);
    const { width, height } = sizeOf(node);
    minCx = Math.min(minCx, x);
    minCy = Math.min(minCy, y);
    minLeft = Math.min(minLeft, x - width / 2);
    maxRight = Math.max(maxRight, x + width / 2);
    minTop = Math.min(minTop, y - height / 2);
    maxBottom = Math.max(maxBottom, y + height / 2);
  }

  let scaleX = 1;
  let scaleY = 1;
  if (aspectRatio && nodes.length > 2 && Number.isFinite(minLeft)) {
    const contentW = maxRight - minLeft;
    const contentH = maxBottom - minTop;
    if (contentW > 0 && contentH > 0) {
      const currentAspect = contentW / contentH;
      if (currentAspect < aspectRatio) {
        scaleX = aspectRatio / currentAspect;
      } else {
        scaleY = currentAspect / aspectRatio;
      }
    }
  }

  return nodes.map((node) => {
    const positioned = g.node(node.id);
    const { width, height } = sizeOf(node);
    const centerX = minCx + (positioned.x - minCx) * scaleX;
    const centerY = minCy + (positioned.y - minCy) * scaleY;
    return {
      ...node,
      position: {
        x: snap(centerX - width / 2, snapGrid),
        y: snap(centerY - height / 2, snapGrid),
      },
      // sourcePosition / targetPosition omitted: OrientedEdge derives the best
      // side live via bestSides() on every fallback render.
    };
  });
}

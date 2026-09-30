const POINTS_PER_INCH = 72;
const NODE_SEPARATION_INCHES = 0.9;
const RANK_SEPARATION_INCHES = 1.2;

type PlainPoint = { x: number; y: number };

type DotNode = { id: string };

type DotEdge = { source: string; target: string };

/** DOT for the dot engine. Node size is in the same pixels the canvas uses. */
export function buildDot(
  nodes: readonly DotNode[],
  edges: readonly DotEdge[],
  nodeWidth: number,
  nodeHeight: number,
): string {
  const widthInches = (nodeWidth / POINTS_PER_INCH).toFixed(3);
  const heightInches = (nodeHeight / POINTS_PER_INCH).toFixed(3);
  const lines = [
    'digraph G {',
    '  rankdir=TB;',
    '  splines=ortho;',
    `  nodesep=${NODE_SEPARATION_INCHES};`,
    `  ranksep=${RANK_SEPARATION_INCHES};`,
    `  node [shape=box, fixedsize=true, width=${widthInches}, height=${heightInches}];`,
  ];
  for (const node of nodes) lines.push(`  ${quoteId(node.id)};`);
  for (const edge of edges) lines.push(`  ${quoteId(edge.source)} -> ${quoteId(edge.target)};`);
  lines.push('}');
  return lines.join('\n');
}

export type PlainEdgeRoute = {
  tail: string;
  head: string;
  points: PlainPoint[];
};

export type PlainLayout = {
  positions: Map<string, { x: number; y: number }>;
  edgeRoutes: PlainEdgeRoute[];
};

/**
 * Converts Graphviz plain output into React Flow coordinates.
 * Y is expected to increase downward (`yInvert` / Graphviz `-y`).
 */
export function parsePlainLayout(plain: string): PlainLayout {
  const centers: { id: string; cx: number; cy: number; width: number; height: number }[] = [];
  const edgeRoutes: PlainEdgeRoute[] = [];

  for (const rawLine of plain.split('\n')) {
    const parts = splitPlain(rawLine.trim());
    if (parts[0] === 'node' && parts.length >= 6) {
      centers.push({
        id: unquote(parts[1]),
        cx: Number(parts[2]) * POINTS_PER_INCH,
        cy: Number(parts[3]) * POINTS_PER_INCH,
        width: Number(parts[4]) * POINTS_PER_INCH,
        height: Number(parts[5]) * POINTS_PER_INCH,
      });
    } else if (parts[0] === 'edge' && parts.length >= 4) {
      const pointCount = Number(parts[3]);
      const points: PlainPoint[] = [];
      for (let index = 0; index < pointCount; index += 1) {
        points.push({
          x: Number(parts[4 + index * 2]) * POINTS_PER_INCH,
          y: Number(parts[5 + index * 2]) * POINTS_PER_INCH,
        });
      }
      edgeRoutes.push({ tail: unquote(parts[1]), head: unquote(parts[2]), points });
    }
  }

  const rawPositions = new Map<string, { x: number; y: number }>();
  for (const node of centers) {
    rawPositions.set(node.id, {
      x: node.cx - node.width / 2,
      y: node.cy - node.height / 2,
    });
  }

  let minX = Infinity;
  let minY = Infinity;
  for (const position of rawPositions.values()) {
    minX = Math.min(minX, position.x);
    minY = Math.min(minY, position.y);
  }
  for (const route of edgeRoutes) {
    for (const point of route.points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
    }
  }
  if (!Number.isFinite(minX)) minX = 0;
  if (!Number.isFinite(minY)) minY = 0;

  const positions = new Map<string, { x: number; y: number }>();
  for (const [id, position] of rawPositions) {
    positions.set(id, { x: position.x - minX, y: position.y - minY });
  }
  return {
    positions,
    edgeRoutes: edgeRoutes.map((route) => ({
      tail: route.tail,
      head: route.head,
      points: route.points.map((point) => ({ x: point.x - minX, y: point.y - minY })),
    })),
  };
}

function quoteId(id: string): string {
  return `"${id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function unquote(token: string): string {
  if (token.startsWith('"') && token.endsWith('"')) {
    return token.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return token;
}

function splitPlain(line: string): string[] {
  const parts: string[] = [];
  let current = '';
  let quoted = false;
  for (const character of line) {
    if (character === '"') {
      quoted = !quoted;
      current += character;
      continue;
    }
    if (character === ' ' && !quoted) {
      if (current) parts.push(current);
      current = '';
      continue;
    }
    current += character;
  }
  if (current) parts.push(current);
  return parts;
}

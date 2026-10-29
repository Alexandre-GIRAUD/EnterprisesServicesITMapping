const POINTS_PER_INCH = 72;
const NODE_SEPARATION_INCHES = 0.9;
const RANK_SEPARATION_INCHES = 1.2;
/** Graphviz repeats a control point; anything closer than this is the same point. */
const DUPLICATE_POINT_PX = 0.5;
/** Ortho splines stop a short gap before the head. Don't follow a bad direction across the map. */
const MAX_ARROW_REACH_PX = 48;
const ZERO_DIRECTION = 1e-9;

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

  const nodesById = new Map(centers.map((node) => [node.id, node]));
  for (const route of edgeRoutes) {
    const head = nodesById.get(route.head);
    route.points = head ? aimRouteAtNode(route.points, head) : dropDuplicatePoints(route.points);
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

type NodeBox = { cx: number; cy: number; width: number; height: number };

function dropDuplicatePoints(points: PlainPoint[]): PlainPoint[] {
  const kept: PlainPoint[] = [];
  for (const point of points) {
    const previous = kept[kept.length - 1];
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < DUPLICATE_POINT_PX) {
      continue;
    }
    kept.push(point);
  }
  return kept;
}

/**
 * Graphviz ortho repeats each control point and stops short of the head.
 * A repeated end gives the arrowhead no direction. Extend the last real
 * segment onto the application border so the arrow points at that app.
 */
function aimRouteAtNode(points: PlainPoint[], node: NodeBox): PlainPoint[] {
  const route = dropDuplicatePoints(points);
  if (route.length < 2) return route;
  const end = route[route.length - 1];
  const previous = route[route.length - 2];
  const deltaX = end.x - previous.x;
  const deltaY = end.y - previous.y;
  const length = Math.hypot(deltaX, deltaY);
  if (length < DUPLICATE_POINT_PX) return route;
  const hit = borderAhead(end, deltaX / length, deltaY / length, node);
  if (!hit) return route;
  const aimed = route.slice();
  aimed[aimed.length - 1] = hit;
  return aimed;
}

function borderAhead(
  origin: PlainPoint,
  directionX: number,
  directionY: number,
  node: NodeBox,
): PlainPoint | null {
  const left = node.cx - node.width / 2;
  const right = node.cx + node.width / 2;
  const top = node.cy - node.height / 2;
  const bottom = node.cy + node.height / 2;
  let near = 0;
  let far = MAX_ARROW_REACH_PX;
  const slabs = [
    { origin: origin.x, direction: directionX, min: left, max: right },
    { origin: origin.y, direction: directionY, min: top, max: bottom },
  ];
  for (const slab of slabs) {
    if (Math.abs(slab.direction) < ZERO_DIRECTION) {
      if (slab.origin < slab.min || slab.origin > slab.max) return null;
      continue;
    }
    let entry = (slab.min - slab.origin) / slab.direction;
    let exit = (slab.max - slab.origin) / slab.direction;
    if (entry > exit) {
      const swap = entry;
      entry = exit;
      exit = swap;
    }
    near = Math.max(near, entry);
    far = Math.min(far, exit);
    if (near > far) return null;
  }
  if (near < DUPLICATE_POINT_PX) return null;
  return { x: origin.x + directionX * near, y: origin.y + directionY * near };
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

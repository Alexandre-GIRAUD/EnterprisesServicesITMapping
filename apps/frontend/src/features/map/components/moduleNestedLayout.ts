import type { GraphEdgeDto, GraphNodeDto } from '../../../types/api.ts';
import { moduleDetailsFromNode, moduleLinkGroups } from '../utils/moduleDetails.ts';
import type { ModuleNode } from './ModuleGraphNode.tsx';

export const MODULE_NODE_WIDTH = 172;
export const MAX_MODULE_NODE_WIDTH = 360;
export const SHORT_NODE_HEIGHT = 56;
const TITLE_CHAR_WIDTH = 8;
const TITLE_LINE_HEIGHT = 17;
const BOX_HORIZONTAL_PADDING = 28;
const BOX_VERTICAL_PADDING = 22;

/** Width a title needs on one line, from its length (no DOM measuring, so the layout stays pure). */
export function estimateTitleWidth(title: string): number {
  return title.length * TITLE_CHAR_WIDTH + BOX_HORIZONTAL_PADDING;
}

/** One size for every module: wide enough for the longest title, wrapping only past the maximum. */
function uniformBoxSize(titles: string[]): { width: number; height: number } {
  const longest = Math.max(0, ...titles.map(estimateTitleWidth));
  const width = Math.min(MAX_MODULE_NODE_WIDTH, Math.max(MODULE_NODE_WIDTH, longest));
  const lines = Math.ceil((longest - BOX_HORIZONTAL_PADDING) / (width - BOX_HORIZONTAL_PADDING)) || 1;
  const height = Math.max(SHORT_NODE_HEIGHT, lines * TITLE_LINE_HEIGHT + BOX_VERTICAL_PADDING);
  return { width, height };
}
export const MODULE_GAP = 16;
export const CONTAINER_PADDING = 20;
export const CONTAINER_HEADER_HEIGHT = 40;
export const EMPTY_APP_MIN_WIDTH = 280;
export const EMPTY_APP_MIN_HEIGHT = 140;
const CENTER_DIVISOR = 2;

type NodeMeta = {
  id: string;
  name: string;
  description: string;
  nodeType: string;
  /** Color slot: the data-link group, or null when no color applies. */
  linkGroup: number | null;
};

export type ModuleTree = {
  rootId: string;
  childrenByParent: Map<string, string[]>;
  nodeMeta: Map<string, NodeMeta>;
  /** True when at least one module exchanges data with another. */
  hasLinks: boolean;
  /** Size shared by every module box. */
  boxSize: { width: number; height: number };
};

/** Build parent → children map from CONTAINS edges (first parent wins on cycles). */
export function buildContainsTree(
  nodes: GraphNodeDto[],
  edges: GraphEdgeDto[]
): ModuleTree | null {
  const appNode = nodes.find((n) => n.type === 'Application');
  if (!appNode) return null;

  const groups = moduleLinkGroups(
    nodes.filter((n) => n.type !== 'Application').map(moduleDetailsFromNode)
  );
  const nodeMeta = new Map<string, NodeMeta>();
  for (const n of nodes) {
    const name = n.label?.trim() || n.id;
    const description = n.description?.trim() ?? '';
    nodeMeta.set(n.id, {
      id: n.id,
      name,
      description,
      nodeType: n.type,
      linkGroup: groups.get(n.id) ?? null,
    });
  }

  const childrenByParent = new Map<string, string[]>();
  const assignedChild = new Set<string>();

  for (const e of edges) {
    if (assignedChild.has(e.targetId)) continue;
    const children = childrenByParent.get(e.sourceId) ?? [];
    if (children.includes(e.targetId)) continue;
    children.push(e.targetId);
    childrenByParent.set(e.sourceId, children);
    assignedChild.add(e.targetId);
  }

  for (const [parentId, children] of childrenByParent) {
    children.sort((a, b) => {
      const nameA = nodeMeta.get(a)?.name ?? a;
      const nameB = nodeMeta.get(b)?.name ?? b;
      return nameA.localeCompare(nameB);
    });
    childrenByParent.set(parentId, children);
  }

  return {
    rootId: appNode.id,
    childrenByParent,
    nodeMeta,
    hasLinks: groups.size > 0,
    boxSize: uniformBoxSize(
      [...nodeMeta.values()].filter((m) => m.nodeType !== 'Application').map((m) => m.name)
    ),
  };
}

/** All descendants of a node (including itself). */
export function collectDescendants(
  rootId: string,
  childrenByParent: Map<string, string[]>
): Set<string> {
  const result = new Set<string>([rootId]);
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    for (const child of childrenByParent.get(id) ?? []) {
      if (!result.has(child)) {
        result.add(child);
        stack.push(child);
      }
    }
  }
  return result;
}

/** Link group wins; with no link anywhere the palette cycles by sibling position instead. */
function colorSlotOf(meta: NodeMeta, siblingIndex: number, tree: ModuleTree): number | null {
  if (meta.nodeType === 'Application') return null;
  if (meta.linkGroup !== null) return meta.linkGroup;
  return tree.hasLinks ? null : siblingIndex;
}

type Layout = { nodes: ModuleNode[]; width: number; height: number };

function gridColumns(count: number, cellWidth: number, cellHeight: number): number {
  if (count <= 1) return 1;
  // Square-looking grid: wider cells call for fewer columns.
  return Math.max(1, Math.min(count, Math.round(Math.sqrt((count * cellHeight) / cellWidth)) + 1));
}

/** Stretch a laid-out child to the cell, keeping its own content centered. */
function fitToCell(child: Layout, cellWidth: number, cellHeight: number): Layout {
  const [root, ...rest] = child.nodes;
  if (!root) return child;
  const shiftX = (cellWidth - child.width) / CENTER_DIVISOR;
  const shiftY = (cellHeight - child.height) / CENTER_DIVISOR;
  const nodes = rest.map((n) =>
    n.parentId === root.id
      ? { ...n, position: { x: n.position.x + shiftX, y: n.position.y + shiftY } }
      : n
  );
  return {
    nodes: [{ ...root, style: { ...root.style, width: cellWidth, height: cellHeight } }, ...nodes],
    width: cellWidth,
    height: cellHeight,
  };
}

type Grid = { nodes: ModuleNode[]; width: number; height: number; top: number };

/** One cell size for the group, one gap between cells, starting `top` below the container header. */
function placeGrid(group: Layout[], top: number): Grid {
  if (group.length === 0) return { nodes: [], width: 0, height: 0, top };
  const cellWidth = Math.max(...group.map((c) => c.width));
  const cellHeight = Math.max(...group.map((c) => c.height));
  const cols = gridColumns(group.length, cellWidth, cellHeight);
  const rows = Math.ceil(group.length / cols);
  const nodes: ModuleNode[] = [];
  group.forEach((child, i) => {
    const [root, ...rest] = fitToCell(child, cellWidth, cellHeight).nodes;
    root.position = {
      x: CONTAINER_PADDING + (i % cols) * (cellWidth + MODULE_GAP),
      y:
        CONTAINER_HEADER_HEIGHT + CONTAINER_PADDING + top + Math.floor(i / cols) * (cellHeight + MODULE_GAP),
    };
    nodes.push(root, ...rest);
  });
  return {
    nodes,
    width: cols * cellWidth + (cols - 1) * MODULE_GAP,
    height: rows * cellHeight + (rows - 1) * MODULE_GAP,
    top,
  };
}

type Placement = { parentId: string | null; depth: number; siblingIndex: number };

function layoutSubtree(
  id: string,
  { parentId, depth, siblingIndex }: Placement,
  tree: ModuleTree,
  visited: Set<string>
): Layout {
  if (visited.has(id)) {
    return { nodes: [], width: 0, height: 0 };
  }
  visited.add(id);

  const meta = tree.nodeMeta.get(id);
  if (!meta) return { nodes: [], width: 0, height: 0 };

  const childIds = tree.childrenByParent.get(id) ?? [];
  const isApp = meta.nodeType === 'Application';
  const isContainer = isApp || childIds.length > 0;
  const colorSlot = colorSlotOf(meta, siblingIndex, tree);

  const nodeOf = (isContainerNode: boolean, width: number, height: number): ModuleNode => ({
    id,
    type: 'module',
    position: { x: 0, y: 0 },
    parentId: parentId ?? undefined,
    extent: parentId ? 'parent' : undefined,
    data: {
      name: meta.name,
      description: meta.description,
      nodeType: meta.nodeType,
      isContainer: isContainerNode,
      depth,
      colorSlot,
    },
    style: { width, height },
  });

  if (!isContainer) {
    const { width, height } = tree.boxSize;
    return { nodes: [nodeOf(false, width, height)], width, height };
  }

  const children = childIds
    .map((childId, i) => layoutSubtree(childId, { parentId: id, depth: depth + 1, siblingIndex: i }, tree, visited))
    .filter((child) => child.nodes.length > 0);

  // Module boxes keep one size; sub-containers get their own grid below them.
  const isLeaf = (child: Layout) => !child.nodes[0].data.isContainer;
  const leafGrid = placeGrid(children.filter(isLeaf), 0);
  const containerGrid = placeGrid(
    children.filter((child) => !isLeaf(child)),
    leafGrid.height === 0 ? 0 : leafGrid.height + MODULE_GAP
  );
  const placed = [...leafGrid.nodes, ...containerGrid.nodes];
  const gridWidth = Math.max(leafGrid.width, containerGrid.width);
  const gridHeight = leafGrid.height === 0 ? containerGrid.height : containerGrid.height === 0 ? leafGrid.height : containerGrid.top + containerGrid.height;

  const minWidth = isApp && children.length === 0 ? EMPTY_APP_MIN_WIDTH : tree.boxSize.width;
  const minHeight =
    isApp && children.length === 0
      ? EMPTY_APP_MIN_HEIGHT
      : CONTAINER_HEADER_HEIGHT + CONTAINER_PADDING * 2;

  const width = Math.max(minWidth, gridWidth + CONTAINER_PADDING * 2);
  const height = Math.max(
    minHeight,
    CONTAINER_HEADER_HEIGHT + CONTAINER_PADDING + gridHeight + CONTAINER_PADDING
  );

  return { nodes: [nodeOf(true, width, height), ...placed], width, height };
}

/** Lay out Application + Module nodes as nested boxes (no edges). */
export function buildModuleNestedNodes(
  nodes: GraphNodeDto[],
  edges: GraphEdgeDto[]
): { rfNodes: ModuleNode[]; tree: ModuleTree | null } {
  const tree = buildContainsTree(nodes, edges);
  if (!tree) return { rfNodes: [], tree: null };

  const { nodes: rfNodes } = layoutSubtree(
    tree.rootId,
    { parentId: null, depth: 0, siblingIndex: 0 },
    tree,
    new Set()
  );
  return { rfNodes, tree };
}

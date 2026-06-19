import type { GraphEdgeDto, GraphNodeDto } from '@/types/api';
import type { ModuleNode } from './ModuleGraphNode';

export const MODULE_NODE_WIDTH = 172;
export const SHORT_NODE_HEIGHT = 56;
export const TALL_NODE_HEIGHT = 96;
export const MODULE_GAP = 16;
export const CONTAINER_PADDING = 20;
export const CONTAINER_HEADER_HEIGHT = 40;
export const EMPTY_APP_MIN_WIDTH = 280;
export const EMPTY_APP_MIN_HEIGHT = 140;

type NodeMeta = {
  id: string;
  name: string;
  description: string;
  nodeType: string;
  hasDescription: boolean;
};

export type ModuleTree = {
  rootId: string;
  childrenByParent: Map<string, string[]>;
  nodeMeta: Map<string, NodeMeta>;
};

/** Build parent → children map from CONTAINS edges (first parent wins on cycles). */
export function buildContainsTree(
  nodes: GraphNodeDto[],
  edges: GraphEdgeDto[]
): ModuleTree | null {
  const appNode = nodes.find((n) => n.type === 'Application');
  if (!appNode) return null;

  const nodeMeta = new Map<string, NodeMeta>();
  for (const n of nodes) {
    const name = n.label?.trim() || n.id;
    const description = n.description?.trim() ?? '';
    nodeMeta.set(n.id, {
      id: n.id,
      name,
      description,
      nodeType: n.type,
      hasDescription: description.length > 0,
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

  return { rootId: appNode.id, childrenByParent, nodeMeta };
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

function leafSize(meta: NodeMeta): { width: number; height: number } {
  return {
    width: MODULE_NODE_WIDTH,
    height: meta.hasDescription ? TALL_NODE_HEIGHT : SHORT_NODE_HEIGHT,
  };
}

function layoutSubtree(
  id: string,
  parentId: string | null,
  depth: number,
  tree: ModuleTree,
  visited: Set<string>
): { nodes: ModuleNode[]; width: number; height: number } {
  if (visited.has(id)) {
    return { nodes: [], width: 0, height: 0 };
  }
  visited.add(id);

  const meta = tree.nodeMeta.get(id);
  if (!meta) return { nodes: [], width: 0, height: 0 };

  const childIds = tree.childrenByParent.get(id) ?? [];
  const isApp = meta.nodeType === 'Application';
  const isContainer = isApp || childIds.length > 0;

  if (!isContainer) {
    const { width, height } = leafSize(meta);
    const node: ModuleNode = {
      id,
      type: 'module',
      position: { x: 0, y: 0 },
      parentId: parentId ?? undefined,
      extent: parentId ? 'parent' : undefined,
      data: {
        name: meta.name,
        description: meta.description,
        nodeType: meta.nodeType,
        isContainer: false,
        depth,
      },
      style: { width, height },
    };
    return { nodes: [node], width, height };
  }

  const contentX = CONTAINER_PADDING;
  const contentY = CONTAINER_HEADER_HEIGHT + CONTAINER_PADDING;

  const orderedNodes: ModuleNode[] = [];
  const childSizes: { width: number; height: number }[] = [];

  for (const childId of childIds) {
    const childLayout = layoutSubtree(childId, id, depth + 1, tree, visited);
    childSizes.push({ width: childLayout.width, height: childLayout.height });
    orderedNodes.push(...childLayout.nodes);
  }

  const cols = childIds.length === 0 ? 1 : Math.ceil(Math.sqrt(childIds.length));
  let xOff = 0;
  let yOff = 0;
  let rowMaxH = 0;
  let gridWidth = 0;

  for (let i = 0; i < childIds.length; i++) {
    const col = i % cols;
    if (col === 0 && i > 0) {
      yOff += rowMaxH + MODULE_GAP;
      xOff = 0;
      rowMaxH = 0;
    }
    const childId = childIds[i];
    const size = childSizes[i];
    const childRoot = orderedNodes.find((n) => n.id === childId);
    if (childRoot) {
      childRoot.position = { x: contentX + xOff, y: contentY + yOff };
    }
    xOff += size.width + MODULE_GAP;
    rowMaxH = Math.max(rowMaxH, size.height);
    gridWidth = Math.max(gridWidth, xOff - MODULE_GAP);
  }

  const gridHeight = childIds.length === 0 ? 0 : yOff + rowMaxH;
  const minWidth = isApp && childIds.length === 0 ? EMPTY_APP_MIN_WIDTH : MODULE_NODE_WIDTH;
  const minHeight =
    isApp && childIds.length === 0
      ? EMPTY_APP_MIN_HEIGHT
      : CONTAINER_HEADER_HEIGHT + CONTAINER_PADDING * 2;

  const width = Math.max(minWidth, gridWidth + CONTAINER_PADDING * 2);
  const height = Math.max(
    minHeight,
    CONTAINER_HEADER_HEIGHT + CONTAINER_PADDING + gridHeight + CONTAINER_PADDING
  );

  const containerNode: ModuleNode = {
    id,
    type: 'module',
    position: { x: 0, y: 0 },
    parentId: parentId ?? undefined,
    extent: parentId ? 'parent' : undefined,
    data: {
      name: meta.name,
      description: meta.description,
      nodeType: meta.nodeType,
      isContainer: true,
      depth,
    },
    style: { width, height },
  };

  return { nodes: [containerNode, ...orderedNodes], width, height };
}

/** Lay out Application + Module nodes as nested boxes (no edges). */
export function buildModuleNestedNodes(
  nodes: GraphNodeDto[],
  edges: GraphEdgeDto[]
): { rfNodes: ModuleNode[]; tree: ModuleTree | null } {
  const tree = buildContainsTree(nodes, edges);
  if (!tree) return { rfNodes: [], tree: null };

  const { nodes: rfNodes } = layoutSubtree(tree.rootId, null, 0, tree, new Set());
  return { rfNodes, tree };
}

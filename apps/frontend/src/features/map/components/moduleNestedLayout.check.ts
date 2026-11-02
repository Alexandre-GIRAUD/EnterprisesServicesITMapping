/**
 * Runnable self-check: module boxes sit on a regular grid, every box the same distance from the
 * mother box, and modules linked by data share a color slot.
 * Run: npx --yes tsx src/features/map/components/moduleNestedLayout.check.ts
 */
import assert from 'node:assert/strict';
import type { GraphEdgeDto, GraphNodeDto } from '../../../types/api.ts';
import type { ModuleNode } from './ModuleGraphNode.tsx';
import {
  buildModuleNestedNodes,
  CONTAINER_HEADER_HEIGHT,
  CONTAINER_PADDING,
  estimateTitleWidth,
  MAX_MODULE_NODE_WIDTH,
  MODULE_GAP,
  SHORT_NODE_HEIGHT,
} from './moduleNestedLayout.ts';

function graph(modules: Array<Partial<GraphNodeDto> & { id: string }>) {
  const nodes: GraphNodeDto[] = [
    { id: 'app', label: 'App', type: 'Application' },
    ...modules.map((m) => ({ label: m.id, type: 'Module', ...m })),
  ];
  const edges: GraphEdgeDto[] = modules.map((m, i) => ({
    id: `e${i}`,
    sourceId: 'app',
    targetId: m.id,
    type: 'CONTAINS',
  })) as GraphEdgeDto[];
  return { nodes, edges };
}

function size(node: ModuleNode) {
  return { width: Number(node.style?.width), height: Number(node.style?.height) };
}

// Regular grid: same cell for every sibling, constant gaps, equal padding on all four sides.
{
  const { nodes, edges } = graph([
    { id: 'a', description: 'has a description so it would be taller' },
    { id: 'b' },
    { id: 'c' },
    { id: 'd' },
    { id: 'e' },
  ]);
  const { rfNodes } = buildModuleNestedNodes(nodes, edges);
  const app = rfNodes.find((n) => n.id === 'app')!;
  const kids = rfNodes.filter((n) => n.parentId === 'app');
  assert.equal(kids.length, 5);

  const cell = size(kids[0]);
  for (const k of kids) assert.deepEqual(size(k), cell);

  const xs = [...new Set(kids.map((k) => k.position.x))].sort((p, q) => p - q);
  const ys = [...new Set(kids.map((k) => k.position.y))].sort((p, q) => p - q);
  for (let i = 1; i < xs.length; i++) assert.equal(xs[i] - xs[i - 1] - cell.width, MODULE_GAP);
  for (let i = 1; i < ys.length; i++) assert.equal(ys[i] - ys[i - 1] - cell.height, MODULE_GAP);

  const { width: appW, height: appH } = size(app);
  assert.equal(xs[0], CONTAINER_PADDING);
  assert.equal(ys[0], CONTAINER_HEADER_HEIGHT + CONTAINER_PADDING);
  assert.equal(appW - (xs[xs.length - 1] + cell.width), CONTAINER_PADDING);
  assert.equal(appH - (ys[ys.length - 1] + cell.height), CONTAINER_PADDING);
}

// Color slots: modules linked by an explicit FEEDS edge share one, an unlinked module stays neutral.
// The FEEDS edge never changes the hierarchy.
{
  const { nodes, edges } = graph([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  const feeds = { id: 'f1', sourceId: 'a', targetId: 'b', type: 'FEEDS', data: 'Trade' } as GraphEdgeDto;
  const { rfNodes } = buildModuleNestedNodes(nodes, [...edges, feeds]);
  const slot = (id: string) => rfNodes.find((n) => n.id === id)!.data.colorSlot;
  assert.equal(slot('a'), slot('b'));
  assert.notEqual(slot('a'), null);
  assert.equal(slot('c'), null);
  assert.deepEqual(
    rfNodes.filter((n) => n.parentId === 'app').map((n) => n.id).sort(),
    ['a', 'b', 'c'],
  );
}

// Data names alone no longer link modules.
{
  const { nodes, edges } = graph([
    { id: 'a', properties: { dataOut: ['Trades'] } },
    { id: 'b', properties: { dataIn: ['Trades'] } },
  ]);
  const { rfNodes } = buildModuleNestedNodes(nodes, edges);
  const slots = rfNodes.filter((n) => n.parentId === 'app').map((n) => n.data.colorSlot);
  assert.deepEqual(slots, [0, 1]);
}

// No link anywhere: default palette cycles by sibling index, so boxes are not all grey.
{
  const { nodes, edges } = graph([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  const { rfNodes } = buildModuleNestedNodes(nodes, edges);
  const slots = rfNodes.filter((n) => n.parentId === 'app').map((n) => n.data.colorSlot);
  assert.deepEqual(slots, [0, 1, 2]);
}

// Title only: every module, in any container, has one size that fits the longest title in full.
{
  const longTitle = 'Settlement instruction matching';
  const { nodes, edges } = graph([
    { id: 'a', label: 'Pricing', description: 'a description no longer adds height' },
    { id: 'b', label: longTitle },
    { id: 'c', label: 'Cash' },
  ]);
  const withNested = {
    nodes: [...nodes, { id: 'n', label: 'Nested leaf', type: 'Module' } as GraphNodeDto],
    edges: [...edges, { id: 'en', sourceId: 'c', targetId: 'n', type: 'CONTAINS' } as GraphEdgeDto],
  };
  const { rfNodes } = buildModuleNestedNodes(withNested.nodes, withNested.edges);
  const leaves = rfNodes.filter((n) => !n.data.isContainer);
  assert.equal(leaves.length, 3);
  const first = size(leaves[0]);
  for (const leaf of leaves) assert.deepEqual(size(leaf), first);
  assert.equal(first.height, SHORT_NODE_HEIGHT);
  assert.ok(first.width >= estimateTitleWidth(longTitle));
}

// Past the maximum width a title wraps, and every box grows to the same taller height.
{
  const { nodes, edges } = graph([{ id: 'a', label: 'X'.repeat(120) }, { id: 'b', label: 'Cash' }]);
  const boxes = buildModuleNestedNodes(nodes, edges).rfNodes.filter((n) => !n.data.isContainer);
  assert.deepEqual(size(boxes[0]), size(boxes[1]));
  assert.equal(size(boxes[0]).width, MAX_MODULE_NODE_WIDTH);
  assert.ok(size(boxes[0]).height > SHORT_NODE_HEIGHT);
}

// A nested container stays neutral by default; only module boxes cycle through the palette.
{
  const { nodes, edges } = graph([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'x' }]);
  const nested = [
    ...edges.filter((e) => e.targetId !== 'x'),
    { id: 'ex', sourceId: 'c', targetId: 'x', type: 'CONTAINS' } as GraphEdgeDto,
  ];
  const { rfNodes } = buildModuleNestedNodes(nodes, nested);
  const slot = (id: string) => rfNodes.find((n) => n.id === id)!.data.colorSlot;
  assert.equal(slot('c'), null);
  assert.deepEqual([slot('a'), slot('b')], [0, 1]);
}

// Siblings follow the explicit links: a module that feeds another comes first.
{
  const { nodes, edges } = graph([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  const feeds = { id: 'f1', sourceId: 'c', targetId: 'a', type: 'FEEDS' } as GraphEdgeDto;
  const { rfNodes } = buildModuleNestedNodes(nodes, [...edges, feeds]);
  const order = rfNodes
    .filter((n) => n.parentId === 'app')
    .sort((p, q) => p.position.y - q.position.y || p.position.x - q.position.x)
    .map((n) => n.id);
  assert.deepEqual(order, ['c', 'a', 'b']);

  const cycle = [
    { id: 'f1', sourceId: 'a', targetId: 'b', type: 'FEEDS' },
    { id: 'f2', sourceId: 'b', targetId: 'a', type: 'FEEDS' },
  ] as GraphEdgeDto[];
  const looped = buildModuleNestedNodes(nodes, [...edges, ...cycle]).rfNodes.filter((n) => n.parentId === 'app');
  assert.equal(looped.length, 3, 'a cycle still lays every module out');
}

console.log('moduleNestedLayout.check: ok');

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
  MODULE_GAP,
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

function size(n: ModuleNode) {
  return { w: Number(n.style?.width), h: Number(n.style?.height) };
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
  for (let i = 1; i < xs.length; i++) assert.equal(xs[i] - xs[i - 1] - cell.w, MODULE_GAP);
  for (let i = 1; i < ys.length; i++) assert.equal(ys[i] - ys[i - 1] - cell.h, MODULE_GAP);

  const { w: appW, h: appH } = size(app);
  assert.equal(xs[0], CONTAINER_PADDING);
  assert.equal(ys[0], CONTAINER_HEADER_HEIGHT + CONTAINER_PADDING);
  assert.equal(appW - (xs[xs.length - 1] + cell.w), CONTAINER_PADDING);
  assert.equal(appH - (ys[ys.length - 1] + cell.h), CONTAINER_PADDING);
}

// Color slots: linked modules share one, an unlinked module stays neutral.
{
  const { nodes, edges } = graph([
    { id: 'a', properties: { dataOut: ['Trades'] } },
    { id: 'b', properties: { dataIn: ['Trades'] } },
    { id: 'c' },
  ]);
  const { rfNodes } = buildModuleNestedNodes(nodes, edges);
  const slot = (id: string) => rfNodes.find((n) => n.id === id)!.data.colorSlot;
  assert.equal(slot('a'), slot('b'));
  assert.notEqual(slot('a'), null);
  assert.equal(slot('c'), null);
}

// No link anywhere: default palette cycles by sibling index, so boxes are not all grey.
{
  const { nodes, edges } = graph([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  const { rfNodes } = buildModuleNestedNodes(nodes, edges);
  const slots = rfNodes.filter((n) => n.parentId === 'app').map((n) => n.data.colorSlot);
  assert.deepEqual(slots, [0, 1, 2]);
}

console.log('moduleNestedLayout.check: ok');

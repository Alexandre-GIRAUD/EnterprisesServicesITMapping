/**
 * Runnable self-check for the "with neighbours" option of a sandbox's filters.
 * Run: npx --yes tsx src/features/map/utils/sandboxNeighbours.check.ts
 */
import assert from 'node:assert/strict';
import type { GraphEdgeDto, GraphNodeDto } from '@/types/api';
import { sandboxFilterScope, type SandboxDocFilters } from './sandboxDocuments.ts';

const node = (id: string) => ({ id, type: 'Application', properties: {} }) as unknown as GraphNodeDto;
const edge = (id: string, sourceId: string, targetId: string) =>
  ({ id, sourceId, targetId, properties: {} }) as unknown as GraphEdgeDto;

const graphNodes = ['a', 'b', 'c', 'd'].map(node);
const graphEdges = [edge('ab', 'a', 'b'), edge('bc', 'b', 'c'), edge('cd', 'c', 'd')];
const filters = (withNeighbours: boolean): SandboxDocFilters => ({
  applicationIds: ['a'],
  nodeAttributes: {},
  nodeRefs: {},
  withNeighbours,
});

assert.equal(sandboxFilterScope({ graphNodes, graphEdges, filters: { applicationIds: [], nodeAttributes: {}, nodeRefs: {} } }), null);

const alone = sandboxFilterScope({ graphNodes, graphEdges, filters: filters(false) })!;
assert.deepEqual([...alone.nodeIds], ['a']);

const widened = sandboxFilterScope({ graphNodes, graphEdges, filters: filters(true) })!;
assert.deepEqual([...widened.nodeIds].sort(), ['a', 'b']);
assert.equal(widened.showsEdge('a', 'b'), true);

const wide = sandboxFilterScope({
  graphNodes,
  graphEdges,
  filters: { ...filters(true), applicationIds: ['b'] },
})!;
assert.deepEqual([...wide.nodeIds].sort(), ['a', 'b', 'c']);
assert.equal(wide.showsEdge('a', 'b'), true);
assert.equal(wide.showsEdge('b', 'c'), true);
assert.equal(wide.showsEdge('c', 'd'), false);

const both = sandboxFilterScope({
  graphNodes,
  graphEdges: [...graphEdges, edge('ac', 'a', 'c')],
  filters: { ...filters(true), applicationIds: ['b'] },
})!;
assert.equal(both.showsEdge('a', 'c'), false, 'a feed between two neighbours is not a neighbour of the selection');

console.log('sandboxNeighbours.check: ok');

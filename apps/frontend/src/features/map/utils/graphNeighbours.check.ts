/**
 * Runnable self-check for the "with neighbour" filter expansion.
 * Run: npx --yes tsx src/features/map/utils/graphNeighbours.check.ts
 */
import assert from 'node:assert/strict';
import { withNeighbours } from './graphNeighbours.ts';

const node = (id: string) => ({ id, type: 'Application', label: id, properties: {} });
const edge = (id: string, sourceId: string, targetId: string) => ({
  id,
  sourceId,
  targetId,
  type: 'DEPENDS_ON',
  properties: {},
});

const full = {
  nodes: [node('a'), node('b'), node('c'), node('d')],
  edges: [edge('ab', 'a', 'b'), edge('ca', 'c', 'a'), edge('cd', 'c', 'd')],
};
const selected = { nodes: [node('a')], edges: [] };

const result = withNeighbours(selected, full);
assert.deepEqual(result.nodes.map((n) => n.id).sort(), ['a', 'b', 'c']);
assert.deepEqual(result.edges.map((e) => e.id).sort(), ['ab', 'ca']);

assert.deepEqual(withNeighbours({ nodes: [], edges: [] }, full), { nodes: [], edges: [] });
console.log('graphNeighbours.check ok');

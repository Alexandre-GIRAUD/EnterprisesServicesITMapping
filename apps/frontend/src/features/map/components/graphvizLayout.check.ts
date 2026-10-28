/**
 * Runnable self-check that Graphviz places a two-node chain.
 * Run: npx --yes tsx src/features/map/components/graphvizLayout.check.ts
 */
import assert from 'node:assert/strict';
import type { Edge, Node } from '@xyflow/react';
import { graphvizLayout } from './graphvizLayout.ts';

const nodes: Node[] = [
  { id: 'a', position: { x: 0, y: 0 }, data: {} },
  { id: 'b', position: { x: 0, y: 0 }, data: {} },
];
const edges: Edge[] = [{ id: 'e1', source: 'a', target: 'b' }];

const laidOut = await graphvizLayout(nodes, edges, { nodeWidth: 160, nodeHeight: 48 });
const above = laidOut.nodes.find((node) => node.id === 'a');
const below = laidOut.nodes.find((node) => node.id === 'b');
assert.ok(above && below);
assert.ok(below.position.y > above.position.y);
const route = laidOut.routes.get('e1');
assert.ok(route && route.length >= 2);

console.log('graphvizLayout.check: ok');

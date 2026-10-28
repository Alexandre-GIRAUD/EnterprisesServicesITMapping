/**
 * Runnable self-check for Graphviz plain-layout parsing.
 * Run: npx --yes tsx src/features/map/components/graphvizPlain.check.ts
 */
import assert from 'node:assert/strict';
import { buildDot, parsePlainLayout } from './graphvizPlain.ts';

const dot = buildDot(
  [{ id: 'a' }, { id: 'b' }],
  [{ source: 'a', target: 'b' }],
  160,
  48,
);
assert.match(dot, /splines=ortho/);
assert.match(dot, /"a" -> "b"/);

const plain = `graph 1 4 5
node a 2 2 2 1
node b 2 4 2 1
edge a b 2 2 2.5 2 3.5
stop
`;

const parsed = parsePlainLayout(plain);
assert.deepEqual(parsed.positions.get('a'), { x: 0, y: 0 });
assert.deepEqual(parsed.positions.get('b'), { x: 0, y: 144 });
assert.equal(parsed.edgeRoutes[0]?.tail, 'a');
assert.equal(parsed.edgeRoutes[0]?.head, 'b');
assert.deepEqual(parsed.edgeRoutes[0]?.points, [
  { x: 72, y: 72 },
  { x: 72, y: 144 },
]);

console.log('graphvizPlain.check: ok');

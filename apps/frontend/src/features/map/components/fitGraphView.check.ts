/**
 * Runnable self-check for the initial graph fit.
 * Run: npx --yes tsx src/features/map/components/fitGraphView.check.ts
 */
import assert from 'node:assert/strict';
import { nodesForHeightFit } from './fitSelection.ts';

const node = (id: string, x: number, y = 0) => ({
  id,
  position: { x, y },
  width: 160,
  height: 48,
});

const pane = { width: 1200, height: 700 };

const compact = [node('a', 0), node('b', 200, 80), node('c', 40, 160)];
assert.deepEqual(
  nodesForHeightFit(compact, pane).map((item) => item.id),
  ['a', 'b', 'c'],
);

const cluster = [node('a', 0), node('b', 200), node('c', 400)];
const stray = [node('d', 2400), node('e', 2600)];
const wide = nodesForHeightFit(
  [...cluster, ...stray],
  pane,
  [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
    { source: 'd', target: 'e' },
  ],
).map((item) => item.id);
assert.ok(wide.every((id) => cluster.some((item) => item.id === id)));
assert.ok(wide.length >= 2);
assert.ok(!wide.includes('d'));

const chain = Array.from({ length: 12 }, (_, index) => node(`n${index}`, index * 220));
const slice = nodesForHeightFit(
  chain,
  pane,
  chain.slice(1).map((item, index) => ({ source: chain[index].id, target: item.id })),
);
assert.ok(slice.length < chain.length);
assert.ok(slice.length >= 2);
assert.deepEqual(
  nodesForHeightFit(
    [node('a', 0), node('b', 200), node('c', 400)],
    pane,
    [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
    ],
  ).map((item) => item.id),
  ['a', 'b', 'c'],
);

console.log('fitGraphView.check: ok');

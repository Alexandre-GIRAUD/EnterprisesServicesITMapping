/**
 * Runnable self-check: a module box shows its title only; the description lives in a hover tip.
 * Run: npx --yes tsx src/features/map/components/moduleNodeCard.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const node = readFileSync(new URL('./ModuleGraphNode.tsx', import.meta.url), 'utf8');
assert.doesNotMatch(node, /module-node-card__description/);
assert.doesNotMatch(node, /module-node-card__divider/);
assert.match(node, /module-node-card__tip/);

const graph = readFileSync(new URL('./ApplicationModuleGraph.tsx', import.meta.url), 'utf8');
assert.doesNotMatch(graph, /buildNodeHoverHint/);

// The name sits in the middle of its box: leaf title and container header are centered.
const css = readFileSync(new URL('../../../index.css', import.meta.url), 'utf8');
const rule = (selector: string): string => {
  const start = css.lastIndexOf(`\n${selector} {`);
  assert.ok(start >= 0, `missing rule ${selector}`);
  return css.slice(start, css.indexOf('}', start));
};
assert.match(rule('.module-node-card__title'), /text-align:\s*center/);
assert.match(rule('.module-node-card__header'), /text-align:\s*center/);
assert.match(rule('.module-node-card'), /justify-content:\s*center/);

// Hovered boxes and their neighbors use the same two-level emphasis as the main graph.
assert.match(node, /moduleTone/);
assert.match(css, /\.module-graph-canvas \.react-flow__node\.is-focus-self \.module-node-card/);

console.log('moduleNodeCard.check: ok');

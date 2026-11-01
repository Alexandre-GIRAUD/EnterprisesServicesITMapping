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

console.log('moduleNodeCard.check: ok');

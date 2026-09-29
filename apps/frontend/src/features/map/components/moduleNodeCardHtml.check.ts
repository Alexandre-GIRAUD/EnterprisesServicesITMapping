/**
 * Runnable self-check: node titles stay whole, so a long name is not treated as clipped.
 * Run: npx --yes tsx src/features/map/components/moduleNodeCardHtml.check.ts
 */
import assert from 'node:assert/strict';
import { buildNodeHoverHint } from './moduleNodeCardHtml.ts';

const longTitle = 'Payments Platform Europe Clearing';

assert.equal(buildNodeHoverHint(longTitle, ''), null);
assert.equal(
  buildNodeHoverHint('Cards', 'A'.repeat(80)),
  `Cards — ${'A'.repeat(80)}`,
);

console.log('moduleNodeCardHtml.check: ok');

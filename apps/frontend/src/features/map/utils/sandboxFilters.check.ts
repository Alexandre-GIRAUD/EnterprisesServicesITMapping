/**
 * Runnable self-check for sandbox blank values and edge attributes.
 * Run: npx --yes tsx src/features/map/utils/sandboxFilters.check.ts
 */
import assert from 'node:assert/strict';
import { graphNodeMatchesSandboxFilters, isSandboxEdgeSelected, isSandboxValueSelected } from './sandboxDocuments.ts';

assert.equal(isSandboxValueSelected(undefined, ['__empty__']), true);
assert.equal(isSandboxValueSelected('  ', ['__empty__']), true);
assert.equal(isSandboxValueSelected('Billing', ['__empty__']), false);
assert.equal(isSandboxValueSelected('Billing', ['Billing', '__empty__']), true);

const node = { id: 'a', type: 'Application', label: 'A', properties: {} };
assert.equal(
  graphNodeMatchesSandboxFilters(node, {
    applicationIds: [],
    nodeAttributes: { description: ['__empty__'] },
    nodeRefs: {},
  }),
  true,
);

assert.equal(
  isSandboxEdgeSelected(
    { id: 'e', sourceId: 'a', targetId: 'b', type: 'DEPENDS_ON', properties: { frequency: 'daily' } },
    { applicationIds: [], nodeAttributes: {}, nodeRefs: {}, edgeAttributes: { frequency: ['weekly'] } },
  ),
  false,
);

console.log('sandboxFilters.check: ok');

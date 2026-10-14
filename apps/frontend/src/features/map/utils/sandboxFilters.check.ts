/**
 * Runnable self-check for sandbox blank values and edge attributes.
 * Run: npx --yes tsx src/features/map/utils/sandboxFilters.check.ts
 */
import assert from 'node:assert/strict';
import { graphNodeMatchesSandboxFilters, sandboxEdgeMatchesFilters, sandboxValueSelected } from './sandboxDocuments.ts';

assert.equal(sandboxValueSelected(undefined, ['__empty__']), true);
assert.equal(sandboxValueSelected('  ', ['__empty__']), true);
assert.equal(sandboxValueSelected('Billing', ['__empty__']), false);
assert.equal(sandboxValueSelected('Billing', ['Billing', '__empty__']), true);

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
  sandboxEdgeMatchesFilters(
    { id: 'e', sourceId: 'a', targetId: 'b', type: 'DEPENDS_ON', properties: { frequency: 'daily' } },
    { applicationIds: [], nodeAttributes: {}, nodeRefs: {}, edgeAttributes: { frequency: ['weekly'] } },
  ),
  false,
);

console.log('sandboxFilters.check: ok');

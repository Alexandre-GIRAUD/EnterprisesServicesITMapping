/**
 * Runnable self-check for sandbox blank values and edge attributes.
 * Run: npx --yes tsx src/features/map/utils/sandboxFilters.check.ts
 */
import assert from 'node:assert/strict';
import { cloneIntoSandboxDocument, copiedSavedSandbox, graphNodeMatchesSandboxFilters, isSandboxEdgeSelected, isSandboxValueSelected } from './sandboxDocuments.ts';

assert.equal(isSandboxValueSelected(undefined, ['__empty__']), true);
assert.equal(isSandboxValueSelected('  ', ['__empty__']), true);
assert.equal(isSandboxValueSelected('Billing', ['__empty__']), false);
assert.equal(isSandboxValueSelected('Billing', ['Billing', '__empty__']), true);

const node = { id: 'a', type: 'Application', label: 'A', properties: {} };
assert.equal(
  graphNodeMatchesSandboxFilters(node, {
    applicationIds: ['a'],
    nodeAttributes: {},
    nodeRefs: {},
    matchNothing: true,
  }),
  false,
);

assert.equal(
  isSandboxEdgeSelected(
    { id: 'e', sourceId: 'a', targetId: 'b', type: 'DEPENDS_ON', properties: { frequency: 'daily' } },
    { applicationIds: [], nodeAttributes: {}, nodeRefs: {}, edgeAttributes: { frequency: ['weekly'] } },
  ),
  false,
);

const source = {
  id: 'pay',
  name: 'Payroll',
  updatedAt: '2020-01-01T00:00:00.000Z',
  folderId: 'finance',
  document: cloneIntoSandboxDocument('Payroll', [], [], [], []),
};
const savedCopy = copiedSavedSandbox(source);
assert.equal(savedCopy.name, 'Payroll copy');
assert.equal(savedCopy.folderId, 'finance');
assert.equal(savedCopy.document.dirty, false);
assert.notEqual(savedCopy.id, 'pay');

console.log('sandboxFilters.check: ok');

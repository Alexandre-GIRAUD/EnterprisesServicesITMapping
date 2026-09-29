/**
 * Runnable self-check for the custom table pivot.
 * Run: npx --yes tsx src/features/map/utils/pivotTable.check.ts
 */
import assert from 'node:assert/strict';
import { buildPivotTable, collectPivotApps, EMPTY_PIVOT_VALUE } from './pivotTable.ts';

const nodeAxes = [
  { key: 'region', kind: 'NODE' as const },
  { key: 'domain', kind: 'NODE' as const },
  { key: 'status', kind: 'NODE' as const },
];

const shaped = collectPivotApps(
  [
    { id: 'a', label: 'Alpha', type: 'Application', properties: { region: 'EMEA', domain: 'Pay', status: 'Live' } },
    { id: 'b', label: 'Beta', type: 'Application', properties: { region: 'EMEA', domain: 'Pay' } },
    { id: 'c', label: 'Gamma', type: 'Application', properties: { domain: 'Risk' } },
    { id: 'd', label: 'Delta', type: 'Module', properties: { region: 'EMEA' } },
  ],
  [],
  nodeAxes,
);

const pivot = buildPivotTable(shaped, {
  rowKey: 'region',
  columnKey: 'domain',
  labelKey: null,
  colorKey: 'status',
});

assert.deepEqual(pivot.rowLabels, ['EMEA', EMPTY_PIVOT_VALUE]);
assert.deepEqual(pivot.columnLabels, ['Pay', 'Risk']);
const emeaPay = pivot.cells[0][0];
assert.deepEqual(emeaPay.map((badge) => badge.text), ['Alpha', 'Beta']);
assert.equal(emeaPay.find((badge) => badge.appId === 'a')?.colorValue, 'Live');
assert.equal(emeaPay.find((badge) => badge.appId === 'b')?.colorValue, null);
assert.equal(shaped.some((app) => app.id === 'd'), false);

const echoed = collectPivotApps(
  [{ id: 'e', label: 'Echo', type: 'Application', properties: { domain: 'Pay' } }],
  [{ id: 'e', nodeRefs: { region: [{ id: 'r1', name: 'EMEA' }, { id: 'r2', name: 'AMER' }] } }],
  [
    { key: 'region', kind: 'NODE_REF' },
    { key: 'domain', kind: 'NODE' },
  ],
);
const split = buildPivotTable(echoed, {
  rowKey: 'region',
  columnKey: 'domain',
  labelKey: 'domain',
  colorKey: null,
});
assert.deepEqual(split.rowLabels, ['AMER', 'EMEA']);
assert.equal(split.cells[0][0][0]?.text, 'Pay');
assert.equal(split.cells[1][0][0]?.text, 'Pay');
assert.equal(split.cells[0][0][0]?.appId, 'e');

console.log('pivotTable.check: ok');

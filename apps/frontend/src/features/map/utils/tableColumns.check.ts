/**
 * Runnable self-check for tableColumns (no test runner in frontend).
 * Run: npx --yes tsx src/features/map/utils/tableColumns.check.ts
 */
import assert from 'node:assert/strict';
import {
  buildAppsColumnCatalog,
  buildFlowsColumnCatalog,
  hideColumn,
  moveColumnInDisplay,
  reconcileDisplayColumnIds,
  showColumn,
} from './tableColumns.ts';
import type { GraphNodeFilterDto } from '../../../types/api.ts';

const filters: GraphNodeFilterDto[] = [
  {
    key: 'tier',
    label: 'Tier',
    values: ['GOLD'],
    fromAllowedValues: true,
    kind: 'NODE',
  },
  {
    key: 'domain',
    label: 'Domain',
    values: ['r1'],
    fromAllowedValues: true,
    kind: 'NODE_REF',
    options: [{ id: 'r1', name: 'Payments' }],
  },
  {
    key: 'protocol',
    label: 'Protocol',
    values: ['API'],
    fromAllowedValues: true,
    kind: 'EDGE',
  },
];

const apps = buildAppsColumnCatalog(filters);
assert.deepEqual(
  apps.map((c) => c.id),
  ['structural:name', 'structural:id', 'structural:description', 'attr:tier', 'attr:domain']
);
assert.ok(!apps.some((c) => c.filterKind === 'EDGE'));

const flows = buildFlowsColumnCatalog(filters);
assert.deepEqual(
  flows.map((c) => c.id),
  ['structural:source', 'structural:target', 'structural:id', 'structural:type', 'attr:protocol']
);
assert.ok(flows.every((c) => c.kind === 'structural' || c.filterKind === 'EDGE'));

const allIds = apps.map((c) => c.id);
assert.deepEqual(reconcileDisplayColumnIds(apps, null), allIds);
assert.deepEqual(reconcileDisplayColumnIds(apps, []), allIds);
assert.deepEqual(
  reconcileDisplayColumnIds(apps, ['attr:tier', 'structural:name', 'ghost']),
  ['attr:tier', 'structural:name', 'structural:id', 'structural:description', 'attr:domain']
);

let display = allIds;
display = hideColumn(display, 'structural:description');
assert.ok(!display.includes('structural:description'));
display = showColumn(display, apps, 'structural:description');
assert.equal(display.at(-1), 'structural:description');
display = moveColumnInDisplay(display, 'attr:tier', 0);
assert.equal(display[0], 'attr:tier');

console.log('tableColumns.check: ok');

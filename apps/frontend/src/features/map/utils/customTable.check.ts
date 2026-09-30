/**
 * Runnable self-check for the custom table axis catalogue.
 * Run: npx --yes tsx src/features/map/utils/customTable.check.ts
 */
import assert from 'node:assert/strict';
import {
  buildAxisOptions,
  buildCustomTable,
  collectCustomTableFacts,
  customTableExportFormats,
  customTableGrid,
  normalizeSetup,
  optionsForSlot,
  reconcileSavedTable,
  type AxisOption,
  type CustomTableCell,
} from './customTable.ts';

const options = buildAxisOptions([
  { key: 'domain', label: 'Domain', kind: 'NODE' },
  { key: 'region', label: 'Region', kind: 'NODE_REF' },
  { key: 'frequency', label: 'Frequency', kind: 'EDGE' },
  { key: 'payload', label: 'Payload', kind: 'EDGE' },
  { key: 'tier', kind: 'NODE' },
]);

assert.deepEqual(options, [
  { id: 'application', key: 'application', kind: 'APPLICATION', direction: null, label: 'Application' },
  { id: 'node:domain', key: 'domain', kind: 'NODE', direction: null, label: 'Domain' },
  { id: 'noderef:region', key: 'region', kind: 'NODE_REF', direction: null, label: 'Region' },
  { id: 'edge:frequency:incoming', key: 'frequency', kind: 'EDGE', direction: 'incoming', label: 'Frequency — incoming' },
  { id: 'edge:frequency:outgoing', key: 'frequency', kind: 'EDGE', direction: 'outgoing', label: 'Frequency — outgoing' },
  { id: 'edge:frequency:any', key: 'frequency', kind: 'EDGE', direction: 'any', label: 'Frequency — any' },
  { id: 'edge:payload:incoming', key: 'payload', kind: 'EDGE', direction: 'incoming', label: 'Payload — incoming' },
  { id: 'edge:payload:outgoing', key: 'payload', kind: 'EDGE', direction: 'outgoing', label: 'Payload — outgoing' },
  { id: 'edge:payload:any', key: 'payload', kind: 'EDGE', direction: 'any', label: 'Payload — any' },
  { id: 'node:tier', key: 'tier', kind: 'NODE', direction: null, label: 'tier' },
]);

const withLaterField = buildAxisOptions([
  { key: 'domain', label: 'Domain' },
  { key: 'cost_center', label: 'Cost center', kind: 'NODE' },
]);

assert.deepEqual(
  withLaterField.map((option) => option.id),
  ['application', 'node:domain', 'node:cost_center'],
);
assert.equal(withLaterField[1]?.label, 'Domain');
assert.equal(withLaterField[2]?.label, 'Cost center');

const domain: AxisOption = { id: 'node:domain', key: 'domain', kind: 'NODE', direction: null, label: 'Domain' };
const region: AxisOption = { id: 'noderef:region', key: 'region', kind: 'NODE_REF', direction: null, label: 'Region' };
const status: AxisOption = { id: 'node:status', key: 'status', kind: 'NODE', direction: null, label: 'Status' };
const application: AxisOption = { id: 'application', key: 'application', kind: 'APPLICATION', direction: null, label: 'Application' };
const frequencyIn: AxisOption = { id: 'edge:frequency:incoming', key: 'frequency', kind: 'EDGE', direction: 'incoming', label: 'Frequency — incoming' };
const frequencyOut: AxisOption = { id: 'edge:frequency:outgoing', key: 'frequency', kind: 'EDGE', direction: 'outgoing', label: 'Frequency — outgoing' };
const frequencyAny: AxisOption = { id: 'edge:frequency:any', key: 'frequency', kind: 'EDGE', direction: 'any', label: 'Frequency — any' };
const payloadIn: AxisOption = { id: 'edge:payload:incoming', key: 'payload', kind: 'EDGE', direction: 'incoming', label: 'Payload — incoming' };
const payloadOut: AxisOption = { id: 'edge:payload:outgoing', key: 'payload', kind: 'EDGE', direction: 'outgoing', label: 'Payload — outgoing' };

const apps = [
  { id: 'a', name: 'Alpha', values: { domain: ['Pay'], region: ['EMEA'], status: ['Live'] } },
  { id: 'b', name: 'Beta', values: { domain: ['Pay'], region: ['EMEA'], status: ['Retired'] } },
  { id: 'c', name: 'Gamma', values: { domain: ['Risk'], region: ['AMER'], status: ['Live'] } },
];

const flows = [
  { id: 'f1', sourceId: 'b', targetId: 'a', values: { frequency: 'Daily', payload: 'Orders' } },
  { id: 'f2', sourceId: 'a', targetId: 'c', values: { frequency: 'Daily', payload: 'Prices' } },
  { id: 'f3', sourceId: 'c', targetId: 'a', values: { frequency: 'Weekly', payload: 'Orders' } },
  { id: 'f4', sourceId: 'a', targetId: 'b', values: { frequency: 'Daily', payload: 'Orders' } },
];

function table(setup: { row?: AxisOption | null; column?: AxisOption | null; label?: AxisOption | null; color?: AxisOption | null }) {
  return buildCustomTable({
    setup: { row: setup.row ?? null, column: setup.column ?? null, label: setup.label ?? null, color: setup.color ?? null },
    apps,
    flows,
  });
}

function countAt(cells: CustomTableCell[][], row: number, column: number): number {
  const cell = cells[row]?.[column];
  assert.equal(cell?.kind, 'count');
  if (cell?.kind !== 'count') return -1;
  return cell.value;
}

function badgeTexts(cells: CustomTableCell[][], row: number, column: number): string[] {
  const cell = cells[row]?.[column];
  assert.equal(cell?.kind, 'badges');
  if (cell?.kind !== 'badges') return [];
  return cell.badges.map((badge) => badge.text);
}

const missingAxis = table({});
assert.equal(missingAxis.status, 'need-axis');
assert.equal(missingAxis.message, 'Choose a row or a column.');

const domainRows = table({ row: domain });
assert.equal(domainRows.status, 'ready');
assert.deepEqual(domainRows.rowLabels, ['Pay', 'Risk']);
assert.deepEqual(domainRows.columnLabels, ['Application']);
assert.deepEqual(badgeTexts(domainRows.cells, 0, 0), ['Alpha', 'Beta']);
assert.deepEqual(badgeTexts(domainRows.cells, 1, 0), ['Gamma']);
assert.deepEqual(domainRows.legendAxes, [{ role: 'Rows', label: 'Domain' }]);
assert.equal(domainRows.countCaption, null);

const domainColumns = table({ column: domain });
assert.deepEqual(domainColumns.rowLabels, ['Application']);
assert.deepEqual(domainColumns.columnLabels, ['Pay', 'Risk']);
assert.deepEqual(badgeTexts(domainColumns.cells, 0, 0), ['Alpha', 'Beta']);

const frequencyRows = table({ row: frequencyIn });
assert.deepEqual(frequencyRows.rowLabels, ['Daily', 'Weekly']);
assert.deepEqual(frequencyRows.columnLabels, ['number of flows']);
assert.equal(countAt(frequencyRows.cells, 0, 0), 3);
assert.equal(countAt(frequencyRows.cells, 1, 0), 1);
assert.equal(frequencyRows.countCaption, 'number of flows');
assert.deepEqual(frequencyRows.swatches, []);

const incomingByApp = table({ row: application, column: frequencyIn, label: status, color: status });
assert.deepEqual(incomingByApp.rowLabels, ['Alpha', 'Beta', 'Gamma']);
assert.deepEqual(incomingByApp.columnLabels, ['Daily', 'Weekly']);
assert.equal(countAt(incomingByApp.cells, 0, 0), 1);
assert.equal(countAt(incomingByApp.cells, 0, 1), 1);
assert.equal(countAt(incomingByApp.cells, 1, 0), 1);
assert.equal(countAt(incomingByApp.cells, 1, 1), 0);
assert.equal(countAt(incomingByApp.cells, 2, 0), 1);
assert.equal(incomingByApp.countCaption, 'number of flows');
assert.deepEqual(incomingByApp.legendAxes.map((axis) => axis.role), ['Rows', 'Columns']);

const outgoingByApp = table({ row: application, column: frequencyOut });
assert.equal(countAt(outgoingByApp.cells, 0, 0), 2);
assert.equal(countAt(outgoingByApp.cells, 2, 1), 1);

const domainFrequency = table({ row: domain, column: frequencyAny });
assert.equal(countAt(domainFrequency.cells, 0, 0), 3);
assert.equal(countAt(domainFrequency.cells, 0, 1), 1);
assert.equal(countAt(domainFrequency.cells, 1, 0), 1);
assert.equal(countAt(domainFrequency.cells, 1, 1), 1);

const sameFlow = table({ row: payloadIn, column: frequencyIn, label: application });
assert.deepEqual(sameFlow.rowLabels, ['Orders', 'Prices']);
assert.deepEqual(sameFlow.columnLabels, ['Daily', 'Weekly']);
assert.deepEqual(badgeTexts(sameFlow.cells, 0, 0), ['Alpha', 'Beta']);
assert.deepEqual(badgeTexts(sameFlow.cells, 0, 1), ['Alpha']);
assert.deepEqual(badgeTexts(sameFlow.cells, 1, 0), ['Gamma']);
assert.deepEqual(badgeTexts(sameFlow.cells, 1, 1), []);
assert.equal(sameFlow.countCaption, null);
assert.deepEqual(sameFlow.legendAxes.map((axis) => axis.role), ['Rows', 'Columns', 'Label']);

const splitFlows = table({ row: payloadOut, column: frequencyIn, label: application });
assert.deepEqual(badgeTexts(splitFlows.cells, 0, 0), ['Alpha', 'Beta', 'Gamma']);
assert.deepEqual(badgeTexts(splitFlows.cells, 0, 1), ['Alpha']);
assert.deepEqual(badgeTexts(splitFlows.cells, 1, 0), ['Alpha']);
assert.deepEqual(badgeTexts(splitFlows.cells, 1, 1), ['Alpha']);

const splitCount = table({ row: payloadOut, column: frequencyIn });
assert.equal(splitCount.countCaption, 'number of applications');
assert.equal(countAt(splitCount.cells, 0, 0), 3);
assert.equal(countAt(splitCount.cells, 1, 1), 1);

const colored = table({ row: domain, column: region, color: status });
assert.deepEqual(badgeTexts(colored.cells, 0, 1), ['Alpha', 'Beta']);
assert.deepEqual(colored.cells[0]?.[1]?.kind === 'badges' ? colored.cells[0][1].badges.map((badge) => badge.colorValue) : [], ['Live', 'Retired']);
assert.deepEqual(colored.swatches, ['Live', 'Retired']);
assert.deepEqual(colored.legendAxes.map((axis) => axis.role), ['Rows', 'Columns', 'Color']);

const labeled = table({ row: domain, column: region, label: status });
assert.deepEqual(badgeTexts(labeled.cells, 0, 1), ['Live', 'Retired']);

const splitRegion = buildCustomTable({
  setup: { row: region, column: frequencyAny, label: null, color: null },
  apps: [{ id: 'a', name: 'Alpha', values: { region: ['EMEA', 'AMER'] } }],
  flows: [{ id: 'f1', sourceId: 'b', targetId: 'a', values: { frequency: 'Daily' } }],
});
assert.deepEqual(splitRegion.rowLabels, ['AMER', 'EMEA']);
assert.equal(countAt(splitRegion.cells, 0, 0), 1);
assert.equal(countAt(splitRegion.cells, 1, 0), 1);

const noApps = buildCustomTable({
  setup: { row: domain, column: null, label: null, color: null },
  apps: [],
  flows: [],
});
assert.equal(noApps.status, 'no-data');
assert.equal(noApps.message, 'Nothing to display.');

const wideFlows = Array.from({ length: 51 }, (_, index) => ({
  id: `w${index}`,
  sourceId: 'a',
  targetId: 'b',
  values: { payload: `P${String(index).padStart(2, '0')}` },
}));
const tooWide = buildCustomTable({
  setup: { row: null, column: { ...payloadIn, direction: 'any', id: 'edge:payload:any', label: 'Payload — any' }, label: null, color: null },
  apps,
  flows: wideFlows,
});
assert.equal(tooWide.status, 'too-large');
assert.equal(tooWide.message, 'This table is too large. Filter the graph or choose a coarser dimension.');
assert.deepEqual(tooWide.cells, []);

const fittingFlows = wideFlows.slice(0, 50);
const fits = buildCustomTable({
  setup: { row: null, column: { ...payloadIn, direction: 'any', id: 'edge:payload:any', label: 'Payload — any' }, label: null, color: null },
  apps,
  flows: fittingFlows,
});
assert.equal(fits.status, 'ready');
assert.equal(fits.columnLabels.length, 50);

const normalized = normalizeSetup({ row: application, column: frequencyIn, label: status, color: status });
assert.equal(normalized.label, null);
assert.equal(normalized.color, null);

const catalogue = buildAxisOptions([
  { key: 'domain', label: 'Business domain', kind: 'NODE' },
  { key: 'frequency', label: 'Frequency', kind: 'EDGE' },
]);
const reconciled = reconcileSavedTable(
  {
    id: '1',
    name: 'Mine',
    row: { id: 'node:domain', label: 'Domain' },
    column: { id: 'edge:rhythm:incoming', label: 'Rhythm — incoming' },
    label: null,
    color: null,
  },
  catalogue,
);
assert.equal(reconciled.setup.row?.label, 'Business domain');
assert.equal(reconciled.setup.column, null);
assert.deepEqual(reconciled.missingLabels, ['Rhythm — incoming']);

assert.deepEqual(
  customTableExportFormats({ row: domain, column: null, label: null, color: null }, 'ready'),
  ['csv', 'excel', 'png', 'pdf'],
);
assert.deepEqual(
  customTableExportFormats({ row: domain, column: region, label: status, color: null }, 'ready'),
  ['png', 'pdf'],
);
assert.deepEqual(customTableExportFormats({ row: domain, column: null, label: null, color: null }, 'too-large'), []);

const grid = customTableGrid(domainRows);
assert.deepEqual(grid?.headers, ['Domain', 'Application']);
assert.deepEqual(grid?.rows[0], ['Pay', 'Alpha, Beta']);

const slotOptions = buildAxisOptions([
  { key: 'domain', label: 'Domain', kind: 'NODE' },
  { key: 'status', label: 'Status', kind: 'NODE' },
  { key: 'frequency', label: 'Frequency', kind: 'EDGE' },
]);
const labelChoices = optionsForSlot('label', { row: domain, column: null, label: null, color: null }, slotOptions);
assert.equal(labelChoices.some((option) => option.id === 'node:domain'), false);
assert.equal(labelChoices.some((option) => option.kind === 'EDGE'), false);
assert.equal(labelChoices.some((option) => option.kind === 'APPLICATION'), true);
assert.deepEqual(optionsForSlot('label', { row: application, column: frequencyIn, label: null, color: null }, slotOptions), []);

const facts = collectCustomTableFacts(
  [{ id: 'a', label: 'Alpha', type: 'Application', properties: { domain: 'Pay' }, nodeRefs: { region: ['EMEA'] } }],
  [{ id: 'b', nodeAttributes: { tier: 'Gold' } }],
  [{ id: 'f1', sourceId: 'a', targetId: 'b', properties: { rhythm: 'Daily' } }],
  [
    { key: 'domain', kind: 'NODE' },
    { key: 'region', kind: 'NODE_REF' },
    { key: 'tier', kind: 'NODE' },
    { key: 'rhythm', kind: 'EDGE' },
  ],
);
assert.deepEqual(facts.apps[0]?.values.domain, ['Pay']);
assert.deepEqual(facts.apps[0]?.values.region, ['EMEA']);
assert.equal(facts.flows[0]?.values.rhythm, 'Daily');

const fromCatalog = collectCustomTableFacts(
  [{ id: 'b', label: 'Beta', type: 'Application' }],
  [{ id: 'b', nodeAttributes: { tier: 'Gold' } }],
  [],
  [{ key: 'tier', kind: 'NODE' }],
);
assert.deepEqual(fromCatalog.apps[0]?.values.tier, ['Gold']);

console.log('customTable.check: ok');

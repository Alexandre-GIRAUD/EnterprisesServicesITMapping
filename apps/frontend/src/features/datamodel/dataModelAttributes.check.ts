/**
 * Runnable self-check for the Data Model attribute list logic.
 * Run: npx --yes tsx src/features/datamodel/dataModelAttributes.check.ts
 */
import assert from 'node:assert/strict';
import type { DataModelFieldDto } from '@/types/api';
import {
  applySavedFields,
  buildSavePayload,
  countRows,
  createEmptyRow,
  filterRows,
  isRowDirty,
  moveRow,
  rowsFromFields,
  validateAllowedValues,
  validateRow,
  type AttributeFilters,
} from './dataModelAttributes.ts';

function field(key: string, patch: Partial<DataModelFieldDto> = {}): DataModelFieldDto {
  return {
    key,
    label: key.toUpperCase(),
    description: '',
    promptHint: '',
    allowedValues: [],
    enforceEnum: false,
    required: false,
    detection: 'AUTOMATIC_DETECTION',
    target: 'EDGE',
    multiple: false,
    ...patch,
  };
}

const noFilters: AttributeFilters = {
  query: '',
  detection: 'ALL',
  isRequiredOnly: false,
  isControlledOnly: false,
};

const rows = rowsFromFields([
  field('asset_class', { label: 'Asset Class', detection: 'MANUAL', enforceEnum: true, allowedValues: ['fx'] }),
  field('frequency', { label: 'Frequency', required: true }),
  field('owner_team', { label: 'Owner team', target: 'NODE' }),
]);
const [assetClass, frequency, ownerTeam] = rows;

// Loaded rows are clean; editing makes them dirty; new rows are always dirty.
assert.equal(isRowDirty(assetClass), false);
assert.equal(isRowDirty({ ...assetClass, draft: { ...assetClass.draft, label: 'Asset' } }), true);
assert.equal(isRowDirty({ ...assetClass, allowedValuesText: 'fx, rates' }), true);
assert.equal(isRowDirty({ ...assetClass, allowedValuesText: ' fx ,' }), false);
assert.equal(isRowDirty(createEmptyRow('flows')), true);

// Counts and filters stay on the active surface.
assert.deepEqual(countRows(filterRows(rows, 'flows', noFilters)), { total: 2, manual: 1, automatic: 1 });
assert.deepEqual(filterRows(rows, 'app', noFilters).map((row) => row.draft.key), ['owner_team']);
assert.deepEqual(
  filterRows(rows, 'flows', { ...noFilters, query: 'ASSET' }).map((row) => row.draft.key),
  ['asset_class']
);
assert.deepEqual(
  filterRows(rows, 'flows', { ...noFilters, query: 'freq' }).map((row) => row.draft.key),
  ['frequency']
);
assert.deepEqual(
  filterRows(rows, 'flows', { ...noFilters, detection: 'MANUAL' }).map((row) => row.draft.key),
  ['asset_class']
);
assert.deepEqual(
  filterRows(rows, 'flows', { ...noFilters, isRequiredOnly: true }).map((row) => row.draft.key),
  ['frequency']
);
assert.deepEqual(
  filterRows(rows, 'flows', { ...noFilters, isControlledOnly: true }).map((row) => row.draft.key),
  ['asset_class']
);

// Immediate validation.
assert.equal(validateRow(assetClass, rows), null);
assert.match(validateRow({ ...frequency, draft: { ...frequency.draft, label: ' ' } }, rows) ?? '', /Label/);
const newRow = createEmptyRow('flows');
assert.match(validateRow({ ...newRow, draft: { ...newRow.draft, key: 'Bad Key', label: 'x' } }, rows) ?? '', /Invalid key/);
assert.match(validateRow({ ...newRow, draft: { ...newRow.draft, key: 'name', label: 'x' } }, rows) ?? '', /Reserved key/);
assert.match(validateRow({ ...newRow, draft: { ...newRow.draft, key: 'frequency', label: 'x' } }, rows) ?? '', /Duplicate key/);
assert.match(validateAllowedValues('fx, rates, FX', assetClass.draft) ?? '', /Duplicate allowed value: FX/);
assert.match(validateAllowedValues(' , ', assetClass.draft) ?? '', /Allowed values required/);
assert.equal(validateAllowedValues('', ownerTeam.draft), null);
assert.match(validateAllowedValues('', { ...ownerTeam.draft, target: 'NODE_REF' }) ?? '', /Allowed values required/);
assert.equal(validateAllowedValues('', frequency.draft), null);

// Saving one row sends every persisted row plus that row's draft, in list order.
const editedFrequency = { ...frequency, draft: { ...frequency.draft, label: 'How often' } };
const unsavedRow = { ...newRow, draft: { ...newRow.draft, key: 'region', label: 'Region' } };
const withEdits = [assetClass, editedFrequency, ownerTeam, unsavedRow];
const payload = buildSavePayload(withEdits, editedFrequency.id);
assert.deepEqual(payload.rowIds, [assetClass.id, frequency.id, ownerTeam.id]);
assert.equal(payload.fields[1].label, 'How often');
assert.deepEqual(buildSavePayload(withEdits, unsavedRow.id).rowIds, [
  assetClass.id,
  frequency.id,
  ownerTeam.id,
  unsavedRow.id,
]);
assert.equal(buildSavePayload(withEdits).fields[1].label, 'Frequency');

// Applying the server response clears the saved row, keeps other drafts.
const otherEdit = { ...assetClass, draft: { ...assetClass.draft, label: 'Pending' } };
const afterSave = applySavedFields(
  [otherEdit, editedFrequency, ownerTeam],
  payload.rowIds,
  payload.fields,
  editedFrequency.id
);
assert.equal(isRowDirty(afterSave[1]), false);
assert.equal(afterSave[1].draft.label, 'How often');
assert.equal(isRowDirty(afterSave[0]), true);

// Drag-and-drop reorder moves a row onto another row's position.
assert.deepEqual(
  moveRow(rows, ownerTeam.id, assetClass.id).map((row) => row.draft.key),
  ['owner_team', 'asset_class', 'frequency']
);
assert.deepEqual(
  moveRow(rows, assetClass.id, frequency.id).map((row) => row.draft.key),
  ['frequency', 'asset_class', 'owner_team']
);

console.log('dataModelAttributes checks passed');

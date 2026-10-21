import type { DataModelDetection, DataModelFieldDto } from '@/types/api';
import { isFlowField, normalizeDataModelTarget, type DataModelSurface } from './dataModelSurface';

const KEY_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;
const RESERVED_KEYS = new Set([
  'id',
  'name',
  'description',
  'year',
  'connection_kind',
  'channel',
  'direction',
  'confidence',
  'discovered_from_application_id',
]);
const ALLOWED_VALUES_SEPARATOR = ', ';

/** One attribute in the list: the editable draft plus what the server last persisted. */
export type AttributeRow = {
  id: string;
  draft: DataModelFieldDto;
  allowedValuesText: string;
  /** Null until the attribute has been saved once. */
  saved: DataModelFieldDto | null;
};

export type DetectionFilter = 'ALL' | DataModelDetection;

export type AttributeFilters = {
  query: string;
  detection: DetectionFilter;
  isRequiredOnly: boolean;
  isControlledOnly: boolean;
};

export type SavePayload = { rowIds: string[]; fields: DataModelFieldDto[] };

let nextRowNumber = 0;

function createRowId(): string {
  nextRowNumber += 1;
  return `attribute-${nextRowNumber}`;
}

export function normalizeDetection(detection?: DataModelDetection): DataModelDetection {
  return detection === 'MANUAL' ? 'MANUAL' : 'AUTOMATIC_DETECTION';
}

export function parseAllowedValues(text: string): string[] {
  return text
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isControlledField(field: DataModelFieldDto): boolean {
  return normalizeDataModelTarget(field.target) === 'NODE_REF' || field.enforceEnum;
}

function normalizeField(field: DataModelFieldDto): DataModelFieldDto {
  const target = normalizeDataModelTarget(field.target);
  return {
    key: field.key.trim().toLowerCase(),
    label: field.label.trim(),
    description: field.description?.trim() ?? '',
    promptHint: field.promptHint?.trim() ?? '',
    allowedValues: (field.allowedValues ?? []).map((value) => value.trim()).filter(Boolean),
    enforceEnum: target === 'NODE_REF' || Boolean(field.enforceEnum),
    required: Boolean(field.required),
    detection: normalizeDetection(field.detection),
    target,
    multiple: Boolean(field.multiple),
  };
}

function rowFromSavedField(id: string, field: DataModelFieldDto): AttributeRow {
  const saved = normalizeField(field);
  return {
    id,
    draft: saved,
    allowedValuesText: (saved.allowedValues ?? []).join(ALLOWED_VALUES_SEPARATOR),
    saved,
  };
}

export function rowsFromFields(fields: DataModelFieldDto[]): AttributeRow[] {
  return fields.map((field) => rowFromSavedField(createRowId(), field));
}

export function createEmptyRow(surface: DataModelSurface): AttributeRow {
  return {
    id: createRowId(),
    draft: normalizeField({
      key: '',
      label: '',
      enforceEnum: false,
      required: false,
      target: surface === 'flows' ? 'EDGE' : 'NODE',
    }),
    allowedValuesText: '',
    saved: null,
  };
}

/** The draft as it would be sent to the server. */
export function draftField(row: AttributeRow): DataModelFieldDto {
  return normalizeField({ ...row.draft, allowedValues: parseAllowedValues(row.allowedValuesText) });
}

export function isRowDirty(row: AttributeRow): boolean {
  if (!row.saved) return true;
  return JSON.stringify(draftField(row)) !== JSON.stringify(row.saved);
}

export function validateAllowedValues(text: string, field: DataModelFieldDto): string | null {
  const values = parseAllowedValues(text);
  const seen = new Set<string>();
  for (const value of values) {
    const normalizedValue = value.toLowerCase();
    if (seen.has(normalizedValue)) return `Duplicate allowed value: ${value}`;
    seen.add(normalizedValue);
  }
  const isReference = normalizeDataModelTarget(field.target) === 'NODE_REF';
  if (isReference && values.length === 0) {
    return 'Allowed values required for Application (reference) attributes.';
  }
  if (field.enforceEnum && values.length === 0) {
    return 'Allowed values required when values are controlled.';
  }
  return null;
}

function validateKey(key: string, otherKeys: Set<string>): string | null {
  if (!KEY_PATTERN.test(key)) {
    return `Invalid key: ${key || '(empty)'}. Use lowercase letters, digits and underscores.`;
  }
  if (RESERVED_KEYS.has(key)) return `Reserved key: ${key}`;
  if (otherKeys.has(key)) return `Duplicate key: ${key}`;
  return null;
}

export function validateRow(row: AttributeRow, rows: AttributeRow[]): string | null {
  const field = draftField(row);
  const otherKeys = new Set(
    rows.filter((other) => other.id !== row.id).map((other) => draftField(other).key)
  );
  return (
    validateKey(field.key, otherKeys) ??
    (field.label ? null : 'Label required.') ??
    validateAllowedValues(row.allowedValuesText, row.draft)
  );
}

function matchesFilters(row: AttributeRow, filters: AttributeFilters): boolean {
  const query = filters.query.trim().toLowerCase();
  const { key, label, detection, required } = row.draft;
  const matchesQuery =
    !query || key.toLowerCase().includes(query) || label.toLowerCase().includes(query);
  const matchesDetection = filters.detection === 'ALL' || normalizeDetection(detection) === filters.detection;
  const matchesRequired = !filters.isRequiredOnly || required;
  const matchesControlled = !filters.isControlledOnly || isControlledField(row.draft);
  return matchesQuery && matchesDetection && matchesRequired && matchesControlled;
}

export function filterRows(
  rows: AttributeRow[],
  surface: DataModelSurface,
  filters: AttributeFilters
): AttributeRow[] {
  return rows.filter(
    (row) => isFlowField(row.draft) === (surface === 'flows') && matchesFilters(row, filters)
  );
}

export function countRows(rows: AttributeRow[]): { total: number; manual: number; automatic: number } {
  const manual = rows.filter((row) => normalizeDetection(row.draft.detection) === 'MANUAL').length;
  return { total: rows.length, manual, automatic: rows.length - manual };
}

export function moveRow(rows: AttributeRow[], fromId: string, toId: string): AttributeRow[] {
  const fromIndex = rows.findIndex((row) => row.id === fromId);
  const toIndex = rows.findIndex((row) => row.id === toId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return rows;
  const reordered = [...rows];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);
  return reordered;
}

/** Every persisted attribute, with the draft of {@code editedRowId} in place of its saved state. */
export function buildSavePayload(rows: AttributeRow[], editedRowId?: string): SavePayload {
  const included = rows.filter((row) => row.saved || row.id === editedRowId);
  return {
    rowIds: included.map((row) => row.id),
    fields: included.map((row) =>
      row.id === editedRowId ? draftField(row) : (row.saved as DataModelFieldDto)
    ),
  };
}

export function applySavedFields(
  rows: AttributeRow[],
  rowIds: string[],
  savedFields: DataModelFieldDto[],
  editedRowId?: string
): AttributeRow[] {
  return rows.map((row) => {
    const index = rowIds.indexOf(row.id);
    if (index < 0) return row;
    if (row.id === editedRowId) return rowFromSavedField(row.id, savedFields[index]);
    return { ...row, saved: normalizeField(savedFields[index]) };
  });
}

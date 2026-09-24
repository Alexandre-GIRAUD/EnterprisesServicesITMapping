import type { GraphNodeFilterDto } from '@/types/api';

export type TableContentKind = 'apps' | 'flows';

export type TableColumnDef = {
  id: string;
  kind: 'structural' | 'attribute';
  key: string;
  label: string;
  table: TableContentKind;
  /** Present for attribute columns (from node-filters). */
  filterKind?: 'NODE' | 'NODE_REF' | 'EDGE';
};

const APPS_STRUCTURAL: Omit<TableColumnDef, 'table'>[] = [
  { id: 'structural:name', kind: 'structural', key: 'name', label: 'Name' },
  { id: 'structural:id', kind: 'structural', key: 'id', label: 'ID' },
  { id: 'structural:description', kind: 'structural', key: 'description', label: 'Description' },
];

const FLOWS_STRUCTURAL: Omit<TableColumnDef, 'table'>[] = [
  { id: 'structural:source', kind: 'structural', key: 'source', label: 'Source' },
  { id: 'structural:target', kind: 'structural', key: 'target', label: 'Target' },
  { id: 'structural:id', kind: 'structural', key: 'id', label: 'ID' },
  { id: 'structural:type', kind: 'structural', key: 'type', label: 'Type' },
];

export const TABLE_COLUMNS_STORAGE_KEY = {
  apps: 'graph.table.columns.apps',
  flows: 'graph.table.columns.flows',
} as const;

function attributeColumnId(key: string): string {
  return `attr:${key}`;
}

function isAppsFilter(dimension: GraphNodeFilterDto): boolean {
  return dimension.kind !== 'EDGE';
}

function isFlowsFilter(dimension: GraphNodeFilterDto): boolean {
  return dimension.kind === 'EDGE';
}

/** Catalogue for Apps: structural + Data Model NODE / NODE_REF (never EDGE). */
export function buildAppsColumnCatalog(filters: GraphNodeFilterDto[]): TableColumnDef[] {
  const structural = APPS_STRUCTURAL.map((c) => ({ ...c, table: 'apps' as const }));
  const attrs = filters.filter(isAppsFilter).map((dimension) => ({
    id: attributeColumnId(dimension.key),
    kind: 'attribute' as const,
    key: dimension.key,
    label: dimension.label?.trim() || dimension.key,
    table: 'apps' as const,
    filterKind: (dimension.kind ?? 'NODE') as 'NODE' | 'NODE_REF',
  }));
  return [...structural, ...attrs];
}

/** Catalogue for Flows: structural + Data Model EDGE only. */
export function buildFlowsColumnCatalog(filters: GraphNodeFilterDto[]): TableColumnDef[] {
  const structural = FLOWS_STRUCTURAL.map((c) => ({ ...c, table: 'flows' as const }));
  const attrs = filters.filter(isFlowsFilter).map((dimension) => ({
    id: attributeColumnId(dimension.key),
    kind: 'attribute' as const,
    key: dimension.key,
    label: dimension.label?.trim() || dimension.key,
    table: 'flows' as const,
    filterKind: 'EDGE' as const,
  }));
  return [...structural, ...attrs];
}

export function buildColumnCatalog(
  table: TableContentKind,
  filters: GraphNodeFilterDto[]
): TableColumnDef[] {
  return table === 'apps' ? buildAppsColumnCatalog(filters) : buildFlowsColumnCatalog(filters);
}

/**
 * Merge stored display ids with the current catalogue:
 * - unknown ids dropped
 * - new catalogue ids appended at end (visible by default)
 * - empty / missing stored → all catalogue ids
 */
export function reconcileDisplayColumnIds(
  catalog: TableColumnDef[],
  stored: string[] | null | undefined
): string[] {
  const catalogIds = catalog.map((c) => c.id);
  const catalogSet = new Set(catalogIds);
  if (!stored || stored.length === 0) return catalogIds;

  const kept = stored.filter((id) => catalogSet.has(id));
  const keptSet = new Set(kept);
  const appended = catalogIds.filter((id) => !keptSet.has(id));
  return [...kept, ...appended];
}

export function loadDisplayColumnIds(table: TableContentKind): string[] | null {
  try {
    const raw = localStorage.getItem(TABLE_COLUMNS_STORAGE_KEY[table]);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return null;
  }
}

export function storeDisplayColumnIds(table: TableContentKind, ids: string[]): void {
  try {
    localStorage.setItem(TABLE_COLUMNS_STORAGE_KEY[table], JSON.stringify(ids));
  } catch {
    /* ignore quota */
  }
}

export function columnsById(catalog: TableColumnDef[]): Map<string, TableColumnDef> {
  return new Map(catalog.map((c) => [c.id, c]));
}

export function visibleColumns(
  catalog: TableColumnDef[],
  displayIds: string[]
): TableColumnDef[] {
  const byId = columnsById(catalog);
  return displayIds.map((id) => byId.get(id)).filter((c): c is TableColumnDef => Boolean(c));
}

export function hiddenColumns(
  catalog: TableColumnDef[],
  displayIds: string[]
): TableColumnDef[] {
  const displaySet = new Set(displayIds);
  return catalog.filter((c) => !displaySet.has(c.id));
}

/** Move id between display/hidden or reorder within display. */
export function moveColumnInDisplay(
  displayIds: string[],
  columnId: string,
  toIndex: number
): string[] {
  const without = displayIds.filter((id) => id !== columnId);
  const clamped = Math.max(0, Math.min(toIndex, without.length));
  return [...without.slice(0, clamped), columnId, ...without.slice(clamped)];
}

export function hideColumn(displayIds: string[], columnId: string): string[] {
  return displayIds.filter((id) => id !== columnId);
}

export function showColumn(
  displayIds: string[],
  catalog: TableColumnDef[],
  columnId: string
): string[] {
  if (displayIds.includes(columnId)) return displayIds;
  if (!catalog.some((c) => c.id === columnId)) return displayIds;
  return [...displayIds, columnId];
}

export type FilterView = 'root' | 'year' | 'applications' | 'businessUnits' | 'regions';

export type DimensionMode = 'none' | 'all' | 'some';

export function dimensionMode(selected: string[], catalog: string[]): DimensionMode {
  if (catalog.length === 0) return 'none';
  if (selected.length === 0) return 'none';
  if (
    selected.length >= catalog.length &&
    catalog.every((id) => selected.includes(id))
  ) {
    return 'all';
  }
  return 'some';
}

export function isAnyDimensionFiltered(modes: DimensionMode[]): boolean {
  return modes.some((m) => m === 'some');
}

/** API params: only send when mode is `some`. */
export function toApiFilterList(
  selected: string[],
  catalog: string[]
): string[] | undefined {
  return dimensionMode(selected, catalog) === 'some' ? selected : undefined;
}

export function toggleSortedValue(values: string[], value: string): string[] {
  const next = values.includes(value)
    ? values.filter((v) => v !== value)
    : [...values, value];
  next.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  return next;
}

export function selectAllCatalog(catalog: string[]): string[] {
  return [...catalog].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export type RootCheckboxState = 'unchecked' | 'checked' | 'indeterminate';

export function rootCheckboxState(mode: DimensionMode): RootCheckboxState {
  if (mode === 'all') return 'checked';
  if (mode === 'some') return 'indeterminate';
  return 'unchecked';
}

/** User-facing status for a filter dimension on the root screen. */
export function dimensionStatusLabel(
  mode: DimensionMode,
  selectedCount: number,
  catalogCount: number,
  entityNamePlural: string
): string {
  if (catalogCount === 0) return `No ${entityNamePlural} available`;
  if (mode === 'all') return `All ${entityNamePlural}`;
  if (mode === 'some') return `${selectedCount} of ${catalogCount} selected`;
  return 'None selected';
}

export function yearFilterLabel(year: number | null): string {
  return year != null ? `Year ${year}` : 'All years';
}

export function hasInvalidDimensionSelection(modes: DimensionMode[]): boolean {
  return modes.some((m) => m === 'none');
}

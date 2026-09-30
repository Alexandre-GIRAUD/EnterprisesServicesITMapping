export type AxisCatalogField = {
  key: string;
  label?: string;
  kind?: 'NODE' | 'NODE_REF' | 'EDGE';
};

export type AxisOption = {
  id: string;
  key: string;
  kind: 'APPLICATION' | 'NODE' | 'NODE_REF' | 'EDGE';
  direction: 'incoming' | 'outgoing' | 'any' | null;
  label: string;
};

/** Catalogue of axis choices. Filled in once the failing check is in place. */
export function buildAxisOptions(_fields: readonly AxisCatalogField[]): AxisOption[] {
  return [];
}

/** Flow attribute never shown in the UI (still stored, returned by the API and exported). */
const HIDDEN_EDGE_ATTRIBUTE = 'dependson';

export function isHiddenEdgeAttribute(key: string): boolean {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '') === HIDDEN_EDGE_ATTRIBUTE;
}

export function withoutHiddenEdgeAttributes<T extends { key: string }>(items: T[]): T[] {
  return items.filter((item) => !isHiddenEdgeAttribute(item.key));
}

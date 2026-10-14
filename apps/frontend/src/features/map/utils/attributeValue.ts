/**
 * A Data Model attribute is one string, or a list when the field allows several values.
 */
export type StoredAttribute = string | string[];

export function storedAttributeList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
}

/** Table cells and history-style text: values in order, separated by a comma and a space. */
export function storedAttributeText(value: unknown): string {
  return storedAttributeList(value).join(', ');
}

export function dedupeAttributeValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    kept.push(trimmed);
  }
  return kept;
}

export function sameAttributeValues(left: unknown, right: unknown): boolean {
  const a = storedAttributeList(left);
  const b = storedAttributeList(right);
  if (a.length !== b.length) return false;
  return a.every((value, index) => value.toLowerCase() === b[index]?.toLowerCase());
}

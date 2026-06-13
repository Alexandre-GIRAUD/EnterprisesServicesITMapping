/** Title likely clipped by 2-line clamp at card width (~11.25rem). */
export function isTitleClamped(name: string): boolean {
  const t = name.trim();
  if (!t) return false;
  if (t.length > 32) return true;
  const longestSegment = t.split(/[/\s._-]+/).reduce((max, part) => Math.max(max, part.length), 0);
  return longestSegment > 18;
}

/** Description likely clipped by line-clamp (hint bar shows full text on hover). */
export function isDescriptionClamped(description: string): boolean {
  return description.trim().length > 72;
}

/** Hint text when title and/or description are clamped in the card. */
export function buildNodeHoverHint(name: string, description: string): string | null {
  const n = name.trim();
  const d = description.trim();
  const titleClamped = n.length > 0 && isTitleClamped(n);
  const descClamped = d.length > 0 && isDescriptionClamped(d);
  if (titleClamped && descClamped) return `${n} — ${d}`;
  if (titleClamped) return n;
  if (descClamped) return n ? `${n} — ${d}` : d;
  return null;
}

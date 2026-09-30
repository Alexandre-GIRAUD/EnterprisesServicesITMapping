/** Description likely clipped by line-clamp (hint bar shows full text on hover). */
export function isDescriptionClamped(description: string): boolean {
  return description.trim().length > 72;
}

/** Hint when the description is clamped. Titles are drawn in full, so they are not hinted. */
export function buildNodeHoverHint(name: string, description: string): string | null {
  const n = name.trim();
  const d = description.trim();
  if (!d || !isDescriptionClamped(d)) return null;
  return n ? `${n} — ${d}` : d;
}

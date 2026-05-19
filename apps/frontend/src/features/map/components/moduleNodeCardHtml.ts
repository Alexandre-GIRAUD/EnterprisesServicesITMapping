/** Card HTML for Cytoscape nodes (escaped for safe innerHTML). */
export type ModuleNodeCardData = {
  name: string;
  description: string;
  nodeType: string;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Card layout: title + optional hr + description.
 * Used with cytoscape-node-html-label (native labels cannot mix font weights / hr).
 * Long titles are clipped via CSS line-clamp (not dynamic node sizing) for a uniform graph layout.
 */
export function buildModuleNodeCardHtml(data: ModuleNodeCardData): string {
  const rawName = data.name.trim() || '—';
  const title = escapeHtml(rawName);
  const desc = data.description?.trim();
  const isApp = data.nodeType === 'Application';
  const cardClass = isApp
    ? 'module-node-card module-node-card--application'
    : 'module-node-card';
  const titleAttr = isTitleClamped(rawName)
    ? ` title="${escapeHtml(rawName)}"`
    : '';

  if (!desc) {
    return `<div class="${cardClass}"${titleAttr}><div class="module-node-card__title">${title}</div></div>`;
  }

  return `<div class="${cardClass}"${titleAttr}>
  <div class="module-node-card__title">${title}</div>
  <hr class="module-node-card__divider" aria-hidden="true" />
  <p class="module-node-card__description">${escapeHtml(desc)}</p>
</div>`;
}

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

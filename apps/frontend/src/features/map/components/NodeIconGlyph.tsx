import { NODE_ICON_GLYPHS } from './nodeIconGlyphs.ts';

/** Modern line icon for a catalog key; nothing for an unknown key. */
export function NodeIconGlyph({ iconKey, size = 16 }: { iconKey: string; size?: number }) {
  const Glyph = NODE_ICON_GLYPHS[iconKey];
  return Glyph ? <Glyph size={size} strokeWidth={1.75} aria-hidden="true" /> : null;
}

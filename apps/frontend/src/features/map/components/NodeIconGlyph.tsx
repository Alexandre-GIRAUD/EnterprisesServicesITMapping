import { NODE_ICON_GLYPHS } from './nodeIconGlyphs.ts';

const DEFAULT_ICON_SIZE_PX = 16;
const ICON_STROKE_WIDTH = 1.75;

/** Modern line icon for a catalog key; nothing for an unknown key. */
export function NodeIconGlyph({ iconKey, size = DEFAULT_ICON_SIZE_PX }: { iconKey: string; size?: number }) {
  const Glyph = NODE_ICON_GLYPHS[iconKey];
  return Glyph ? <Glyph size={size} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" /> : null;
}

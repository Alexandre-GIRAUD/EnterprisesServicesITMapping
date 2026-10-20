export const LEGEND_BASE_FONT_PX = 12;
export const LEGEND_MIN_FONT_PX = 9;

/** Wider legend boxes pick up extra columns so entries reflow instead of staying one tall stack. */
export function legendColumnCount(widthPx: number): number {
  if (widthPx >= 440) return 3;
  if (widthPx >= 260) return 2;
  return 1;
}

export function nextLegendFontPx(currentPx: number, stillOverflows: boolean): number {
  if (!stillOverflows || currentPx <= LEGEND_MIN_FONT_PX) return currentPx;
  return Math.max(LEGEND_MIN_FONT_PX, currentPx - 0.5);
}

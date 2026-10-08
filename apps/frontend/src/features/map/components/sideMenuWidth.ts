export const MIN_MENU_WIDTH = 240;
export const DEFAULT_MENU_WIDTH = 300;
export const EXPANDED_MENU_WIDTH = 360;
export const MAX_MENU_WIDTH = 640;
export const MENU_RESIZE_STEP = 16;

/** Clamp a menu width to the spec: at least 240, at most half the panel and 640. */
export function clampMenuWidth(width: number, panelWidth: number): number {
  const upper = Math.min(MAX_MENU_WIDTH, panelWidth / 2);
  const lower = Math.min(MIN_MENU_WIDTH, upper);
  return Math.min(upper, Math.max(lower, width));
}

export const MIN_MENU_WIDTH = 240;
export const DEFAULT_MENU_WIDTH = 300;
export const EXPANDED_MENU_WIDTH = 360;
export const MIN_GRAPH_WIDTH = 280;
export const MENU_RESIZE_STEP = 16;

/** Widest menu that still leaves a strip of graph. */
export function maxMenuWidth(panelWidth: number): number {
  return Math.max(0, panelWidth - MIN_GRAPH_WIDTH);
}

/** Clamp a menu width: at least 240, until the graph keeps 280 px. */
export function clampMenuWidth(width: number, panelWidth: number): number {
  const upper = maxMenuWidth(panelWidth);
  const lower = Math.min(MIN_MENU_WIDTH, upper);
  return Math.min(upper, Math.max(lower, width));
}

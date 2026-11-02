export const DRAWER_MIN_WIDTH_PX = 320;

/** Room kept to the pane edges. */
const PANE_MARGIN_PX = 24;
const MAX_PANE_SHARE = 0.8;

/** Between a readable minimum and most of the pane; a pane narrower than the minimum wins. */
export function clampDrawerWidth(width: number, paneWidth: number): number {
  const max = Math.max(0, Math.min(paneWidth * MAX_PANE_SHARE, paneWidth - PANE_MARGIN_PX));
  const min = Math.min(DRAWER_MIN_WIDTH_PX, max);
  return Math.round(Math.max(min, Math.min(width, max)));
}

type DragWidth = { startWidth: number; startX: number; x: number; paneWidth: number };

/** The drawer sits on the right, so dragging its left edge to the left widens it. */
export function dragDrawerWidth({ startWidth, startX, x, paneWidth }: DragWidth): number {
  return clampDrawerWidth(startWidth + startX - x, paneWidth);
}

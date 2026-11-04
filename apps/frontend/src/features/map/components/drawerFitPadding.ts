import type { FitViewOptions } from '@xyflow/react';

/** How much room fitView leaves around the graph: a ratio, or per side (ratio or CSS px). */
export type FitViewPadding = NonNullable<FitViewOptions['padding']>;

const FIT_RATIO = 0.06;

export const MODULE_DRAWER_WIDTH_PX = 440;
export const DETAILS_DRAWER_WIDTH_PX = 420;

/** The drawer's margin to the pane edge, with a little air. */
export const DRAWER_FIT_GAP_PX = 30;

/** Never leave the drawer more than this share of a narrow pane. */
const MAX_DRAWER_SHARE = 0.6;

/** Fit the graph beside the drawer when it is open, so the drawer never hides a box. */
type DrawerFit = { paneWidthPx?: number; drawerWidthPx?: number };

/** Beyond this share of the pane the floating chrome would leave the graph no room: keep the plain margin. */
const MAX_CHROME_SHARE = 0.6;

/** Air between the legend's right edge and the fitted graph. */
export const LEGEND_FIT_GAP_PX = 24;

/**
 * Fit the graph between the legend (floating over the pane's left edge) and the open side menu
 * (floating over its right edge), so neither hides a box.
 */
export function computeLegendFitPadding(
  legendRightPx?: number,
  menuWidthPx?: number,
  paneWidthPx?: number
): FitViewPadding {
  const hasLegend = legendRightPx !== undefined && legendRightPx > 0;
  const hasMenu = menuWidthPx !== undefined && menuWidthPx > 0;
  if (!hasLegend && !hasMenu) return FIT_RATIO;
  const insetPx = (hasLegend ? legendRightPx : 0) + (hasMenu ? menuWidthPx : 0) + 2 * LEGEND_FIT_GAP_PX;
  if (paneWidthPx !== undefined && insetPx > paneWidthPx * MAX_CHROME_SHARE) return FIT_RATIO;
  return {
    top: FIT_RATIO,
    bottom: FIT_RATIO,
    left: hasLegend ? `${Math.ceil(legendRightPx + LEGEND_FIT_GAP_PX)}px` : FIT_RATIO,
    right: hasMenu ? `${Math.ceil(menuWidthPx + LEGEND_FIT_GAP_PX)}px` : FIT_RATIO,
  };
}

export function computeDrawerFitPadding(
  isDrawerOpen: boolean,
  { paneWidthPx, drawerWidthPx = MODULE_DRAWER_WIDTH_PX }: DrawerFit = {}
): FitViewPadding {
  if (!isDrawerOpen) return FIT_RATIO;
  const insetPx = drawerWidthPx + DRAWER_FIT_GAP_PX;
  const roomPx = paneWidthPx ? Math.min(insetPx, Math.floor(paneWidthPx * MAX_DRAWER_SHARE)) : insetPx;
  return {
    top: FIT_RATIO,
    bottom: FIT_RATIO,
    left: FIT_RATIO,
    right: `${roomPx}px`,
  };
}

function paddingPx(value: number | string | undefined, sideLengthPx: number): number {
  if (typeof value === 'number') return value * sideLengthPx;
  if (typeof value === 'string') return value.endsWith('%') ? (parseFloat(value) / 100) * sideLengthPx : parseFloat(value) || 0;
  return 0;
}

/** Width over height of the pane area the fit really fills (pane minus margins, legend and menu). */
export function fitAreaAspectRatio(paneWidthPx: number, paneHeightPx: number, padding: FitViewPadding): number | undefined {
  const sides = typeof padding === 'object' ? padding : { top: padding, bottom: padding, left: padding, right: padding };
  const width = paneWidthPx - paddingPx(sides.left, paneWidthPx) - paddingPx(sides.right, paneWidthPx);
  const height = paneHeightPx - paddingPx(sides.top, paneHeightPx) - paddingPx(sides.bottom, paneHeightPx);
  return width > 0 && height > 0 ? width / height : undefined;
}

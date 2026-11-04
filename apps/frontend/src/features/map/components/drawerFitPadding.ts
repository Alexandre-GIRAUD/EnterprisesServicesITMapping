import type { FitViewOptions } from '@xyflow/react';

/** How much room fitView leaves around the graph: a ratio, or per side (ratio or CSS px). */
export type FitViewPadding = NonNullable<FitViewOptions['padding']>;

const FIT_RATIO = 0.15;

export const MODULE_DRAWER_WIDTH_PX = 440;
export const DETAILS_DRAWER_WIDTH_PX = 420;

/** The drawer's margin to the pane edge, with a little air. */
export const DRAWER_FIT_GAP_PX = 30;

/** Never leave the drawer more than this share of a narrow pane. */
const MAX_DRAWER_SHARE = 0.6;

/** Fit the graph beside the drawer when it is open, so the drawer never hides a box. */
type DrawerFit = { paneWidthPx?: number; drawerWidthPx?: number };

/** Air between the legend's right edge and the fitted graph. */
export const LEGEND_FIT_GAP_PX = 24;

/** Fit the graph to the right of the legend, which floats over the pane's left edge. */
export function computeLegendFitPadding(legendRightPx?: number): FitViewPadding {
  if (!legendRightPx || legendRightPx <= 0) return FIT_RATIO;
  return {
    top: FIT_RATIO,
    bottom: FIT_RATIO,
    left: `${Math.ceil(legendRightPx + LEGEND_FIT_GAP_PX)}px`,
    right: FIT_RATIO,
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

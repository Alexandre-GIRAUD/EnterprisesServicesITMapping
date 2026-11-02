import type { FitViewOptions } from '@xyflow/react';

/** How much room fitView leaves around the graph: a ratio, or per side (ratio or CSS px). */
export type FitViewPadding = NonNullable<FitViewOptions['padding']>;

const MODULE_FIT_RATIO = 0.15;

/** The 440px drawer plus its margin to the pane edge, with a little air. */
export const DRAWER_FIT_INSET_PX = 470;

/** Never leave the drawer more than this share of a narrow pane. */
const MAX_DRAWER_SHARE = 0.6;

/** Fit the module graph beside the drawer when it is open, so the drawer never hides a box. */
export function moduleFitPadding(isDrawerOpen: boolean, paneWidthPx?: number): FitViewPadding {
  if (!isDrawerOpen) return MODULE_FIT_RATIO;
  const insetPx = paneWidthPx ? Math.min(DRAWER_FIT_INSET_PX, Math.floor(paneWidthPx * MAX_DRAWER_SHARE)) : DRAWER_FIT_INSET_PX;
  return {
    top: MODULE_FIT_RATIO,
    bottom: MODULE_FIT_RATIO,
    left: MODULE_FIT_RATIO,
    right: `${insetPx}px`,
  };
}

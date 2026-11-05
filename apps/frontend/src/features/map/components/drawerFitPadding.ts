import type { FitViewOptions } from '@xyflow/react';

/** How much room fitView leaves around the graph: a ratio, or per side (ratio or CSS px). */
export type FitViewPadding = NonNullable<FitViewOptions['padding']>;

export const FIT_RATIO = 0.06;

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
  paneWidthPx?: number,
  headerBottomPx?: number
): FitViewPadding {
  const hasLegend = legendRightPx !== undefined && legendRightPx > 0;
  const hasMenu = menuWidthPx !== undefined && menuWidthPx > 0;
  const hasHeader = headerBottomPx !== undefined && headerBottomPx > 0;
  if (!hasLegend && !hasMenu && !hasHeader) return FIT_RATIO;
  const insetPx = (hasLegend ? legendRightPx : 0) + (hasMenu ? menuWidthPx : 0) + 2 * LEGEND_FIT_GAP_PX;
  if (paneWidthPx !== undefined && insetPx > paneWidthPx * MAX_CHROME_SHARE) return FIT_RATIO;
  return {
    top: hasHeader ? `${Math.ceil(headerBottomPx + TITLE_FIT_GAP_PX)}px` : FIT_RATIO,
    bottom: FIT_RATIO,
    left: hasLegend ? `${Math.ceil(legendRightPx + LEGEND_FIT_GAP_PX)}px` : FIT_RATIO,
    right: hasMenu ? `${Math.ceil(menuWidthPx + LEGEND_FIT_GAP_PX)}px` : FIT_RATIO,
  };
}

/** Air between a floating sandbox title and the fitted graph. */
export const TITLE_FIT_GAP_PX = 12;

/** A rectangle in screen pixels. */
export type ChromeBox = { left: number; top: number; right: number; bottom: number };

function boxesOverlap(first: ChromeBox, second: ChromeBox): boolean {
  return (
    first.left < second.right &&
    first.right > second.left &&
    first.top < second.bottom &&
    first.bottom > second.top
  );
}

/**
 * Fit a sandbox below its floating title and to the right of the legend when that legend floats
 * over it, so neither hides a box. An inset that would eat most of the pane gives way to the margin.
 */
export function computeChromeFitPadding(
  pane: ChromeBox,
  titleBar: ChromeBox | null,
  legend: ChromeBox | null,
): FitViewPadding {
  const paneWidth = pane.right - pane.left;
  const paneHeight = pane.bottom - pane.top;
  const titleInset = titleBar ? titleBar.bottom - pane.top + TITLE_FIT_GAP_PX : 0;
  const legendInset = legend && boxesOverlap(legend, pane) ? legend.right - pane.left + LEGEND_FIT_GAP_PX : 0;
  const hasTitleRoom = titleInset > 0 && titleInset <= paneHeight * MAX_CHROME_SHARE;
  const hasLegendRoom = legendInset > 0 && legendInset <= paneWidth * MAX_CHROME_SHARE;
  return {
    top: hasTitleRoom ? `${Math.ceil(titleInset)}px` : FIT_RATIO,
    bottom: FIT_RATIO,
    left: hasLegendRoom ? `${Math.ceil(legendInset)}px` : FIT_RATIO,
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

const PERCENT_DIVISOR = 100;

function convertPaddingToPixels(value: number | string | undefined, sideLengthPx: number): number {
  if (typeof value === 'number') return value * sideLengthPx;
  if (typeof value !== 'string') return 0;
  const amount = parseFloat(value);
  if (Number.isNaN(amount)) return 0;
  return value.endsWith('%') ? (amount / PERCENT_DIVISOR) * sideLengthPx : amount;
}

/** Width over height of the pane area the fit really fills (pane minus margins, legend and menu). */
export function computeFitAreaAspectRatio(paneWidthPx: number, paneHeightPx: number, padding: FitViewPadding): number | undefined {
  const sides = typeof padding === 'object' ? padding : { top: padding, bottom: padding, left: padding, right: padding };
  const width = paneWidthPx - convertPaddingToPixels(sides.left, paneWidthPx) - convertPaddingToPixels(sides.right, paneWidthPx);
  const height = paneHeightPx - convertPaddingToPixels(sides.top, paneHeightPx) - convertPaddingToPixels(sides.bottom, paneHeightPx);
  return width > 0 && height > 0 ? width / height : undefined;
}

export const LEGEND_REFERENCE_SIDE_PX = 264;
export const LEGEND_MIN_FONT_SCALE = 0.65;
export const LEGEND_MAX_FONT_SCALE = 1;
export const LEGEND_WIDE_ASPECT = 2;
export const DEFAULT_LEGEND_WIDTH_PX = 220;
export const DEFAULT_LEGEND_HEIGHT_PX = 360;

/** Top gap of the legend inside the pane (matches the shared legend anchor). */
export const LEGEND_TOP_MARGIN_PX = 10;
/** Bottom-left room kept free for the zoom controls. */
export const LEGEND_CONTROLS_CLEARANCE_PX = 120;
const LEGEND_MIN_HEIGHT_PX = 80;

export type LegendOffset = { left: number; top: number };
export type LegendSize = { width: number; height: number };
export type LegendPane = LegendSize & { insetLeft?: number; insetTop?: number };
export type LegendEntryDirection = 'row' | 'column';

/** Row once the frame is at least twice as wide as it is tall. */
export function chooseLegendEntryDirection(width: number, height: number): LegendEntryDirection {
  if (height <= 0) return 'column';
  if (width / height >= LEGEND_WIDE_ASPECT) return 'row';
  return 'column';
}

/** Shrink labels with the shorter side, down to 65%, never above the original size. */
export function measureLegendFontScale(width: number, height: number): number {
  const shorterSide = Math.min(width, height);
  const rawScale = shorterSide / LEGEND_REFERENCE_SIDE_PX;
  if (rawScale < LEGEND_MIN_FONT_SCALE) return LEGEND_MIN_FONT_SCALE;
  if (rawScale > LEGEND_MAX_FONT_SCALE) return LEGEND_MAX_FONT_SCALE;
  return rawScale;
}

/** Keep a dragged legend inside the pane. A frame larger than the pane stays at the origin. */
export function clampLegendOffset(
  offset: LegendOffset,
  frame: LegendSize,
  pane: LegendPane,
): LegendOffset {
  const insetLeft = pane.insetLeft ?? 0;
  const insetTop = pane.insetTop ?? 0;
  const minLeft = -insetLeft || 0;
  const minTop = -insetTop || 0;
  const maxLeft = pane.width - insetLeft - frame.width;
  const maxTop = pane.height - insetTop - frame.height;
  if (maxLeft < minLeft || maxTop < minTop) return { left: 0, top: 0 };
  return {
    left: clampToRange(offset.left, minLeft, maxLeft),
    top: clampToRange(offset.top, minTop, maxTop),
  };
}

function clampToRange(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** Shorten the default height so the legend never reaches the zoom controls. */
export function fitLegendHeight(height: number, paneHeight: number): number {
  const room = paneHeight - LEGEND_TOP_MARGIN_PX - LEGEND_CONTROLS_CLEARANCE_PX;
  return Math.max(LEGEND_MIN_HEIGHT_PX, Math.min(height, room));
}

/** Frame covering the whole pane, margin kept so the pane borders stay visible. */
export function fillLegendFrame(
  pane: LegendPane,
  margin: number,
): { offset: LegendOffset; size: LegendSize } {
  return {
    offset: { left: margin - (pane.insetLeft ?? 0), top: margin - (pane.insetTop ?? 0) },
    size: { width: pane.width - 2 * margin, height: pane.height - 2 * margin },
  };
}

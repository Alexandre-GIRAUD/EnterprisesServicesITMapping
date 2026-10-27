export const LEGEND_REFERENCE_SIDE_PX = 264;
export const LEGEND_MIN_FONT_SCALE = 0.65;
export const LEGEND_MAX_FONT_SCALE = 1;
export const LEGEND_WIDE_ASPECT = 2;
export const DEFAULT_LEGEND_WIDTH_PX = 264;
export const DEFAULT_LEGEND_HEIGHT_PX = 360;

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

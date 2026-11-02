export const LEGEND_REFERENCE_SIDE_PX = 264;
export const LEGEND_MIN_FONT_SCALE = 0.65;
export const LEGEND_MAX_FONT_SCALE = 1;
export const LEGEND_WIDE_ASPECT = 2;
export const DEFAULT_LEGEND_WIDTH_PX = 220;
export const DEFAULT_LEGEND_HEIGHT_PX = 360;

/** Top gap of the legend inside the pane (matches the shared legend anchor). */
const LEGEND_TOP_MARGIN_PX = 10;
/** Bottom-left room kept free for the zoom controls. */
export const LEGEND_CONTROLS_CLEARANCE_PX = 120;
/** Mirror the min-width (8rem) and min-height (5rem) of the legend stylesheet rule. */
export const LEGEND_MIN_WIDTH_PX = 128;
export const LEGEND_MIN_HEIGHT_PX = 80;
/** The native resize grip is the bottom-right corner of the frame. */
const RESIZE_GRIP_PX = 18;
const MAX_SNUG_GROW_PASSES = 4;

export type LegendOffset = { left: number; top: number };
export type LegendSize = { width: number; height: number };
export type LegendPane = LegendSize & { insetLeft?: number; insetTop?: number };
export type LegendFrame = { offset: LegendOffset; size: LegendSize };
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

/**
 * Shorten the height so the legend never reaches the zoom controls.
 * `clearance` is the measured room the controls take; the default is a safe estimate.
 */
export function fitLegendHeight(
  height: number,
  paneHeight: number,
  clearance: number = LEGEND_CONTROLS_CLEARANCE_PX,
): number {
  const room = paneHeight - LEGEND_TOP_MARGIN_PX - clearance;
  return Math.max(LEGEND_MIN_HEIGHT_PX, Math.min(height, room));
}

/** Frame covering the whole pane, margin kept so the pane borders stay visible. */
export function fillLegendFrame(
  pane: LegendPane,
  margin: number,
): LegendFrame {
  return {
    offset: { left: margin - (pane.insetLeft ?? 0), top: margin - (pane.insetTop ?? 0) },
    size: { width: pane.width - 2 * margin, height: pane.height - 2 * margin },
  };
}

/** The pane-filling frame only while editing: a stale fill must never outlive the edit mode. */
export function pickShownLegendFrame(
  isFilling: boolean,
  fill: LegendFrame | null,
  own: LegendFrame,
): LegendFrame {
  return isFilling && fill ? fill : own;
}

export type LegendContentSize = { scrollWidth: number; scrollHeight: number };

function clampBetween(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/**
 * The snuggest frame: the narrowest width that cuts no text or button, then the shortest height
 * at that width. `measure` lays the legend out in the given frame and reports how much room its
 * content needs; the layout can change with the frame, so the frame grows until nothing is cut.
 */
export function snugLegendSize(
  measure: (frame: LegendSize) => LegendContentSize,
  limit: LegendSize,
): LegendSize {
  const narrow = measure({ width: LEGEND_MIN_WIDTH_PX, height: LEGEND_MIN_HEIGHT_PX });
  let width = clampBetween(narrow.scrollWidth, LEGEND_MIN_WIDTH_PX, limit.width);
  const short = measure({ width, height: LEGEND_MIN_HEIGHT_PX });
  let height = clampBetween(short.scrollHeight, LEGEND_MIN_HEIGHT_PX, limit.height);
  for (let pass = 0; pass < MAX_SNUG_GROW_PASSES; pass += 1) {
    const seen = measure({ width, height });
    const grownWidth = clampBetween(seen.scrollWidth, width, limit.width);
    const grownHeight = clampBetween(seen.scrollHeight, height, limit.height);
    if (grownWidth === width && grownHeight === height) break;
    width = grownWidth;
    height = grownHeight;
  }
  return { width, height };
}

/** True when the pointer is on the native resize grip of a frame whose box ends at `right`/`bottom`. */
export function isResizeGrip(box: { right: number; bottom: number }, x: number, y: number): boolean {
  return box.right - x <= RESIZE_GRIP_PX && box.bottom - y <= RESIZE_GRIP_PX;
}

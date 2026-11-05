/** How long the pane width must hold still before the sandbox refits: the menu slide takes 260ms. */
export const WIDTH_STABLE_MS = 120;

/** Width changes below this are layout rounding, not a menu moving. */
const WIDTH_TOLERANCE_PX = 1;

export type RefitTracking = {
  /** The pane width the graph was last fitted to. */
  fittedWidthPx: number;
  /** The latest observed pane width. */
  widthPx: number;
  /** When that width last changed. */
  changedAtMs: number;
  /** The user zoomed or panned since the width began to move. */
  hasUserTakenOver: boolean;
};

export function startRefitTracking(widthPx: number, nowMs: number): RefitTracking {
  return { fittedWidthPx: widthPx, widthPx, changedAtMs: nowMs, hasUserTakenOver: false };
}

export function observeWidth(state: RefitTracking, widthPx: number, nowMs: number): RefitTracking {
  if (Math.abs(widthPx - state.widthPx) < WIDTH_TOLERANCE_PX) return state;
  return { ...state, widthPx, changedAtMs: nowMs };
}

/** The width differs from the fitted one and has held still long enough. */
export function isWidthSettled(state: RefitTracking, nowMs: number): boolean {
  const hasMoved = Math.abs(state.widthPx - state.fittedWidthPx) >= WIDTH_TOLERANCE_PX;
  return hasMoved && nowMs - state.changedAtMs >= WIDTH_STABLE_MS;
}

export function shouldRefit(state: RefitTracking, nowMs: number): boolean {
  return !state.hasUserTakenOver && isWidthSettled(state, nowMs);
}

/** Record the width as handled, after a refit or after skipping one the user cancelled. */
export function markFitted(state: RefitTracking, widthPx: number): RefitTracking {
  return { ...state, fittedWidthPx: widthPx, widthPx, hasUserTakenOver: false };
}

/** The user zoomed or panned: drop the pending refit. */
export function takeOver(state: RefitTracking): RefitTracking {
  return { ...state, hasUserTakenOver: true };
}

/** React Flow hands over the DOM event for a user gesture and null for its own fitView. */
export function isUserMove(event: unknown): boolean {
  return event !== null && event !== undefined;
}

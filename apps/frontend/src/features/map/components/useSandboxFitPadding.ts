import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { FIT_RATIO, computeChromeFitPadding, type FitViewPadding } from './drawerFitPadding.ts';
import {
  WIDTH_STABLE_MS,
  isWidthSettled,
  markFitted,
  observeWidth,
  shouldRefit,
  startRefitTracking,
  takeOver,
  type RefitTracking,
} from './sandboxRefit.ts';

const TITLE_BAR_SELECTOR = '.sandbox-pane__bar';
const LEGEND_SELECTOR = '.graph-legend';
/** React Flow measures its boxes one frame after mounting and the legend settles another: wait two. */
const SETTLE_FRAME_COUNT = 2;
export const SETTLE_REFIT_DURATION_MS = 150;

function readBox(element: Element | null) {
  if (!element) return null;
  const { left, top, right, bottom } = element.getBoundingClientRect();
  return { left, top, right, bottom };
}

function measurePadding(pane: HTMLElement): FitViewPadding {
  const paneBox = readBox(pane);
  if (!paneBox) return FIT_RATIO;
  return computeChromeFitPadding(
    paneBox,
    readBox(pane.querySelector(TITLE_BAR_SELECTOR)),
    readBox(document.querySelector(LEGEND_SELECTOR)),
  );
}

/**
 * How much room a sandbox's fit leaves for its floating title and the shared legend.
 * The legend settles a moment after the panes, so `onSettled` refits once with the final padding.
 * When the side menu then opens or closes, it refits again once the pane width has held still,
 * unless the user zoomed or panned meanwhile: call `cancelRefit` from those gestures.
 */
export function useSandboxFitPadding(
  paneRef: RefObject<HTMLElement | null>,
  onSettled: (padding: FitViewPadding) => void,
): { padding: FitViewPadding; cancelRefit: () => void } {
  const [padding, setPadding] = useState<FitViewPadding>(FIT_RATIO);
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;
  const trackingRef = useRef<RefitTracking | null>(null);

  useLayoutEffect(() => {
    if (paneRef.current) setPadding(measurePadding(paneRef.current));
  }, [paneRef]);

  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    const readWidth = () => pane.getBoundingClientRect().width;
    const fit = () => {
      const settled = measurePadding(pane);
      setPadding(settled);
      onSettledRef.current(settled);
    };
    trackingRef.current = startRefitTracking(readWidth(), performance.now());

    let framesLeft = SETTLE_FRAME_COUNT;
    let frame = 0;
    const waitThenSettle = () => {
      framesLeft -= 1;
      if (framesLeft > 0) {
        frame = requestAnimationFrame(waitThenSettle);
        return;
      }
      fit();
      if (trackingRef.current) trackingRef.current = markFitted(trackingRef.current, readWidth());
    };
    frame = requestAnimationFrame(waitThenSettle);

    let stableTimer: ReturnType<typeof setTimeout> | undefined;
    const refitIfStable = () => {
      const tracking = trackingRef.current;
      if (!tracking) return;
      const now = performance.now();
      if (shouldRefit(tracking, now)) fit();
      if (isWidthSettled(tracking, now)) trackingRef.current = markFitted(tracking, tracking.widthPx);
    };
    const observer = new ResizeObserver(() => {
      if (!trackingRef.current) return;
      trackingRef.current = observeWidth(trackingRef.current, readWidth(), performance.now());
      clearTimeout(stableTimer);
      stableTimer = setTimeout(refitIfStable, WIDTH_STABLE_MS);
    });
    observer.observe(pane);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(stableTimer);
      observer.disconnect();
      trackingRef.current = null;
    };
  }, [paneRef]);

  const cancelRefit = useCallback(() => {
    if (trackingRef.current) trackingRef.current = takeOver(trackingRef.current);
  }, []);

  return { padding, cancelRefit };
}

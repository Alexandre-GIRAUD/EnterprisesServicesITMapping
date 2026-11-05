import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import { FIT_RATIO, computeChromeFitPadding, type FitViewPadding } from './drawerFitPadding.ts';

const TITLE_BAR_SELECTOR = '.sandbox-pane__bar';
const LEGEND_SELECTOR = '.graph-legend';

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
 * How much room a sandbox's first fit leaves for its floating title and the shared legend.
 * The legend settles a moment after the panes, so `onSettled` refits once with the final padding.
 */
export function useSandboxFitPadding(
  paneRef: RefObject<HTMLElement | null>,
  onSettled: (padding: FitViewPadding) => void,
): FitViewPadding {
  const [padding, setPadding] = useState<FitViewPadding>(FIT_RATIO);

  useLayoutEffect(() => {
    if (paneRef.current) setPadding(measurePadding(paneRef.current));
  }, [paneRef]);

  useEffect(() => {
    const settle = () => {
      if (!paneRef.current) return;
      const settled = measurePadding(paneRef.current);
      setPadding(settled);
      onSettled(settled);
    };
    const frame = requestAnimationFrame(() => requestAnimationFrame(settle));
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one settle after mount
  }, [paneRef]);

  return padding;
}

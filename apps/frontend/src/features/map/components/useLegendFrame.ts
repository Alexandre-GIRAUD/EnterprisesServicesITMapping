import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import {
  DEFAULT_LEGEND_HEIGHT_PX,
  DEFAULT_LEGEND_WIDTH_PX,
  clampLegendOffset,
  legendEntryDirection,
  legendFontScale,
  type LegendOffset,
  type LegendSize,
} from './legendFrame.ts';

const DRAG_START_THRESHOLD_PX = 4;
const LEGEND_CONTROL_SELECTOR = 'button, input, select, textarea, a';
const LEGEND_DRAG_HANDLE_SELECTOR = '.graph-legend__header, .graph-legend__show';
const LEGEND_PANE_SELECTOR = '.react-flow, .sandbox-stage, #graph-canvas-pane';

type LegendFrameStyle = CSSProperties & { '--legend-font-scale': string };

type DragSession = {
  frameRef: RefObject<HTMLDivElement | null>;
  offset: LegendOffset;
  sizeRef: { current: LegendSize };
  concealedRef: { current: boolean };
  suppressClickRef: { current: boolean };
  setOffset: (offset: LegendOffset) => void;
};

export function useLegendFrame(frameRef: RefObject<HTMLDivElement | null>) {
  const [offset, setOffset] = useState<LegendOffset>({ left: 0, top: 0 });
  const [size, setSize] = useState<LegendSize>({
    width: DEFAULT_LEGEND_WIDTH_PX,
    height: DEFAULT_LEGEND_HEIGHT_PX,
  });
  const [isConcealed, setIsConcealed] = useState(false);
  const sizeRef = useRef(size);
  const concealedRef = useRef(isConcealed);
  const suppressClickRef = useRef(false);
  sizeRef.current = size;
  concealedRef.current = isConcealed;

  useEffect(() => {
    const element = frameRef.current;
    if (!element || isConcealed) return undefined;
    const observer = new ResizeObserver((entries) => {
      rememberObservedSize(entries[0], concealedRef, setSize);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [frameRef, isConcealed]);

  const style = legendFrameStyle(offset, size, isConcealed);

  return {
    isConcealed,
    direction: legendEntryDirection(size.width, size.height),
    style,
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
      event.stopPropagation();
      beginLegendDrag(event, {
        frameRef,
        offset,
        sizeRef,
        concealedRef,
        suppressClickRef,
        setOffset,
      });
    },
    onToggleClick: (event: { preventDefault: () => void }) => {
      if (!suppressClickRef.current) {
        setIsConcealed((value) => !value);
        return;
      }
      suppressClickRef.current = false;
      event.preventDefault();
    },
  };
}

function legendFrameStyle(
  offset: LegendOffset,
  size: LegendSize,
  isConcealed: boolean,
): LegendFrameStyle {
  const style: LegendFrameStyle = {
    left: offset.left,
    top: offset.top,
    '--legend-font-scale': String(legendFontScale(size.width, size.height)),
  };
  if (isConcealed) return style;
  style.width = size.width;
  style.height = size.height;
  return style;
}

function rememberObservedSize(
  entry: ResizeObserverEntry | undefined,
  concealedRef: { current: boolean },
  setSize: (update: (current: LegendSize) => LegendSize) => void,
): void {
  if (!entry || concealedRef.current) return;
  const next = borderBox(entry);
  setSize((current) => (sameSize(current, next) ? current : next));
}

function borderBox(entry: ResizeObserverEntry): LegendSize {
  const box = entry.borderBoxSize?.[0];
  if (!box) {
    return {
      width: Math.round(entry.contentRect.width),
      height: Math.round(entry.contentRect.height),
    };
  }
  return { width: Math.round(box.inlineSize), height: Math.round(box.blockSize) };
}

function sameSize(current: LegendSize, next: LegendSize): boolean {
  return current.width === next.width && current.height === next.height;
}

function beginLegendDrag(event: ReactPointerEvent<HTMLElement>, session: DragSession): void {
  if (event.button !== 0) return;
  const target = event.target;
  if (!(target instanceof Element) || !isDragHandle(target, session.concealedRef.current)) return;
  if (!target.closest(LEGEND_CONTROL_SELECTOR)) event.preventDefault();

  const startX = event.clientX;
  const startY = event.clientY;
  const origin = session.offset;
  let moved = false;

  const onMove = (moveEvent: PointerEvent) => {
    moved = moved || passedDragThreshold(moveEvent.clientX - startX, moveEvent.clientY - startY);
    moveLegend(session, origin, moveEvent.clientX - startX, moveEvent.clientY - startY);
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (moved) session.suppressClickRef.current = true;
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

function isDragHandle(target: Element, isConcealed: boolean): boolean {
  const startedOnControl = target.closest(LEGEND_CONTROL_SELECTOR) !== null;
  if (startedOnControl && !isConcealed) return false;
  return target.closest(LEGEND_DRAG_HANDLE_SELECTOR) !== null;
}

function passedDragThreshold(deltaX: number, deltaY: number): boolean {
  return Math.hypot(deltaX, deltaY) > DRAG_START_THRESHOLD_PX;
}

function moveLegend(session: DragSession, origin: LegendOffset, deltaX: number, deltaY: number): void {
  const element = session.frameRef.current;
  if (!element) return;
  session.setOffset(
    clampLegendOffset(
      { left: origin.left + deltaX, top: origin.top + deltaY },
      dragFrameSize(element, session),
      legendRoom(element),
    ),
  );
}

function dragFrameSize(element: HTMLElement, session: DragSession): LegendSize {
  if (!session.concealedRef.current) return session.sizeRef.current;
  const rect = element.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

function legendRoom(element: HTMLElement): LegendSize {
  const paneRect = legendPane(element).getBoundingClientRect();
  const origin = element.offsetParent instanceof HTMLElement
    ? element.offsetParent.getBoundingClientRect()
    : paneRect;
  return {
    width: paneRect.right - origin.left,
    height: paneRect.bottom - origin.top,
  };
}

function legendPane(element: HTMLElement): HTMLElement {
  const pane = element.closest(LEGEND_PANE_SELECTOR);
  if (pane instanceof HTMLElement) return pane;
  if (element.offsetParent instanceof HTMLElement) return element.offsetParent;
  return element;
}

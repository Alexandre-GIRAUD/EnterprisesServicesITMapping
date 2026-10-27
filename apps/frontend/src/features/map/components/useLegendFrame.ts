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
  chooseLegendEntryDirection,
  clampLegendOffset,
  measureLegendFontScale,
  type LegendOffset,
  type LegendPane,
  type LegendSize,
} from './legendFrame.ts';

const DRAG_START_THRESHOLD_PX = 4;
const PRIMARY_POINTER_BUTTON = 0;
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

type LegendFrameBindings = {
  isConcealed: boolean;
  direction: ReturnType<typeof chooseLegendEntryDirection>;
  style: LegendFrameStyle;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onToggleClick: (event: { preventDefault: () => void }) => void;
};

export function useLegendFrame(frameRef: RefObject<HTMLDivElement | null>): LegendFrameBindings {
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
  useLegendResizeObserver({ frameRef, isConcealed, concealedRef, setSize });
  useKeepLegendInside({ frameRef, isConcealed, size, setOffset });

  return bindLegendFrame({
    frameRef,
    offset,
    size,
    isConcealed,
    sizeRef,
    concealedRef,
    suppressClickRef,
    setOffset,
    setIsConcealed,
  });
}

type LegendResizeWatch = {
  frameRef: RefObject<HTMLDivElement | null>;
  isConcealed: boolean;
  concealedRef: { current: boolean };
  setSize: (update: (current: LegendSize) => LegendSize) => void;
};

type LegendFrameInput = {
  frameRef: RefObject<HTMLDivElement | null>;
  offset: LegendOffset;
  size: LegendSize;
  isConcealed: boolean;
  sizeRef: { current: LegendSize };
  concealedRef: { current: boolean };
  suppressClickRef: { current: boolean };
  setOffset: (offset: LegendOffset) => void;
  setIsConcealed: (update: (value: boolean) => boolean) => void;
};

function useKeepLegendInside(watch: {
  frameRef: RefObject<HTMLDivElement | null>;
  isConcealed: boolean;
  size: LegendSize;
  setOffset: (update: (current: LegendOffset) => LegendOffset) => void;
}): void {
  const { frameRef, isConcealed, size, setOffset } = watch;
  useEffect(() => {
    const element = frameRef.current;
    if (!element || isConcealed) return;
    const pane = readLegendPaneBox(element);
    setOffset((current) => keepLegendInsidePane(current, size, pane));
  }, [frameRef, isConcealed, size, setOffset]);
}

function useLegendResizeObserver(watch: LegendResizeWatch): void {
  const { frameRef, isConcealed, concealedRef, setSize } = watch;
  useEffect(() => {
    const element = frameRef.current;
    if (!element || isConcealed) return undefined;
    const observer = new ResizeObserver((entries) => {
      rememberObservedSize(entries[0], concealedRef, setSize);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [frameRef, isConcealed, concealedRef, setSize]);
}

function bindLegendFrame(input: LegendFrameInput): LegendFrameBindings {
  const session: DragSession = {
    frameRef: input.frameRef,
    offset: input.offset,
    sizeRef: input.sizeRef,
    concealedRef: input.concealedRef,
    suppressClickRef: input.suppressClickRef,
    setOffset: input.setOffset,
  };
  return {
    isConcealed: input.isConcealed,
    direction: chooseLegendEntryDirection(input.size.width, input.size.height),
    style: buildLegendFrameStyle(input.offset, input.size, input.isConcealed),
    onPointerDown: (event) => {
      event.stopPropagation();
      beginLegendDrag(event, session);
    },
    onToggleClick: (event) => {
      toggleConcealedLegend(event, input.suppressClickRef, input.setIsConcealed);
    },
  };
}

function toggleConcealedLegend(
  event: { preventDefault: () => void },
  suppressClickRef: { current: boolean },
  setIsConcealed: (update: (value: boolean) => boolean) => void,
): void {
  if (!suppressClickRef.current) {
    setIsConcealed((value) => !value);
    return;
  }
  suppressClickRef.current = false;
  event.preventDefault();
}

function buildLegendFrameStyle(
  offset: LegendOffset,
  size: LegendSize,
  isConcealed: boolean,
): LegendFrameStyle {
  const style: LegendFrameStyle = {
    left: offset.left,
    top: offset.top,
    '--legend-font-scale': String(measureLegendFontScale(size.width, size.height)),
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
  const next = readBorderBox(entry);
  setSize((current) => (isSameSize(current, next) ? current : next));
}

function readBorderBox(entry: ResizeObserverEntry): LegendSize {
  const box = entry.borderBoxSize?.[0];
  if (!box) {
    return {
      width: Math.round(entry.contentRect.width),
      height: Math.round(entry.contentRect.height),
    };
  }
  return { width: Math.round(box.inlineSize), height: Math.round(box.blockSize) };
}

function isSameSize(current: LegendSize, next: LegendSize): boolean {
  return current.width === next.width && current.height === next.height;
}

function beginLegendDrag(event: ReactPointerEvent<HTMLElement>, session: DragSession): void {
  if (event.button !== PRIMARY_POINTER_BUTTON) return;
  const target = event.target;
  if (!(target instanceof Element) || !isDragHandle(target, session.concealedRef.current)) return;
  if (!target.closest(LEGEND_CONTROL_SELECTOR)) event.preventDefault();

  const startClientX = event.clientX;
  const startClientY = event.clientY;
  const origin = session.offset;
  let hasMoved = false;

  const onMove = (moveEvent: PointerEvent) => {
    const horizontalDelta = moveEvent.clientX - startClientX;
    const verticalDelta = moveEvent.clientY - startClientY;
    hasMoved = hasMoved || hasPassedDragThreshold(horizontalDelta, verticalDelta);
    moveLegend({ session, origin, horizontalDelta, verticalDelta });
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (hasMoved) session.suppressClickRef.current = true;
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

function isDragHandle(target: Element, isConcealed: boolean): boolean {
  const isOnControl = target.closest(LEGEND_CONTROL_SELECTOR) !== null;
  if (isOnControl && !isConcealed) return false;
  return target.closest(LEGEND_DRAG_HANDLE_SELECTOR) !== null;
}

function hasPassedDragThreshold(horizontalDelta: number, verticalDelta: number): boolean {
  return Math.hypot(horizontalDelta, verticalDelta) > DRAG_START_THRESHOLD_PX;
}

function moveLegend(move: {
  session: DragSession;
  origin: LegendOffset;
  horizontalDelta: number;
  verticalDelta: number;
}): void {
  const element = move.session.frameRef.current;
  if (!element) return;
  move.session.setOffset(
    clampLegendOffset(
      {
        left: move.origin.left + move.horizontalDelta,
        top: move.origin.top + move.verticalDelta,
      },
      readDragFrameSize(element, move.session),
      readLegendPaneBox(element),
    ),
  );
}

function keepLegendInsidePane(current: LegendOffset, size: LegendSize, pane: LegendPane): LegendOffset {
  const next = clampLegendOffset(current, size, pane);
  if (next.left === current.left && next.top === current.top) return current;
  return next;
}

function readDragFrameSize(element: HTMLElement, session: DragSession): LegendSize {
  if (!session.concealedRef.current) return session.sizeRef.current;
  const rect = element.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

function readLegendPaneBox(element: HTMLElement): LegendPane {
  const paneRect = findLegendPane(element).getBoundingClientRect();
  const origin = element.offsetParent instanceof HTMLElement
    ? element.offsetParent.getBoundingClientRect()
    : paneRect;
  return {
    width: paneRect.width,
    height: paneRect.height,
    insetLeft: origin.left - paneRect.left,
    insetTop: origin.top - paneRect.top,
  };
}

function findLegendPane(element: HTMLElement): HTMLElement {
  const pane = element.closest(LEGEND_PANE_SELECTOR);
  if (pane instanceof HTMLElement) return pane;
  if (element.offsetParent instanceof HTMLElement) return element.offsetParent;
  return element;
}

import {
  useEffect,
  useLayoutEffect,
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
  fillLegendFrame,
  fitLegendHeight,
  isResizeGrip,
  legendMaxHeight,
  measureLegendFontScale,
  pickShownLegendFrame,
  measureSnugLegendSize,
  type LegendContentSize,
  type LegendOffset,
  type LegendPane,
  type LegendSize,
} from './legendFrame.ts';
import { recallLegend, rememberLegend } from './legendMemory.ts';

const DRAG_START_THRESHOLD_PX = 4;
const LEGEND_FILL_MARGIN_PX = 8;
/** Room kept between a snug legend and the pane's right edge. */
const LEGEND_SNUG_RIGHT_MARGIN_PX = 24;
/** The snug height has no limit of its own: only the pane limits it. */
const NO_HEIGHT_LIMIT_PX = Number.MAX_SAFE_INTEGER;
const PRIMARY_POINTER_BUTTON = 0;
const LEGEND_CONTROL_SELECTOR = 'button, input, select, textarea, a';
const LEGEND_DRAG_HANDLE_SELECTOR = '.graph-legend__header';
const ZOOM_CONTROLS_SELECTOR = '.react-flow__controls';
const ZOOM_CONTROLS_GAP_PX = 8;
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

type LegendFill = ReturnType<typeof fillLegendFrame>;

/**
 * `isFilling` stretches the legend over the whole pane (edit mode), then restores its own frame.
 * The frame is the snuggest one until the user drags the resize grip, and it outlives the component.
 * A new `concealSignal` value folds the legend into its launcher.
 */
export function useLegendFrame(
  frameRef: RefObject<HTMLDivElement | null>,
  isFilling = false,
  concealSignal = 0,
): LegendFrameBindings {
  const [remembered] = useState(recallLegend);
  const [offset, setOffset] = useState<LegendOffset>(remembered?.offset ?? { left: 0, top: 0 });
  const [size, setSize] = useState<LegendSize>(
    remembered?.size ?? { width: DEFAULT_LEGEND_WIDTH_PX, height: DEFAULT_LEGEND_HEIGHT_PX },
  );
  const [isUserSized, setIsUserSized] = useState(remembered?.isUserSized ?? false);
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);
  const [isConcealed, setIsConcealed] = useState(false);
  const [fill, setFill] = useState<LegendFill | null>(null);
  const sizeRef = useRef(size);
  const concealedRef = useRef(isConcealed);
  const resizingRef = useRef(false);
  const suppressClickRef = useRef(false);
  sizeRef.current = size;
  concealedRef.current = isConcealed;
  useEffect(() => {
    rememberLegend({ offset, size, isUserSized });
  }, [offset, size, isUserSized]);
  useConcealOnSignal(concealSignal, setIsConcealed);
  useSnugFit({ frameRef, isEnabled: !isUserSized && !isConcealed && !isFilling, setSize });
  useFitDefaultHeight(frameRef, setMaxHeight);
  useLegendResizeObserver({
    frameRef,
    isConcealed: isConcealed || isFilling,
    concealedRef,
    resizingRef,
    setSize,
  });
  useKeepLegendInside({ frameRef, isConcealed: isConcealed || isFilling, size, setOffset });
  useFillPane(frameRef, isFilling, setFill);

  return bindLegendFrame({
    frameRef,
    offset,
    size,
    isConcealed,
    isFilling,
    fill,
    maxHeight,
    resizingRef,
    sizeRef,
    concealedRef,
    suppressClickRef,
    setOffset,
    setIsConcealed,
    setIsUserSized,
  });
}

function useConcealOnSignal(
  signal: number,
  setIsConcealed: (update: (value: boolean) => boolean) => void,
): void {
  const seenSignal = useRef(signal);
  useEffect(() => {
    if (signal === seenSignal.current) return;
    seenSignal.current = signal;
    setIsConcealed(() => true);
  }, [signal, setIsConcealed]);
}

type SnugFitWatch = {
  frameRef: RefObject<HTMLDivElement | null>;
  isEnabled: boolean;
  setSize: (size: LegendSize) => void;
};

/** Refit the frame to its content whenever the text inside changes, until the user sizes it by hand. */
function useSnugFit({ frameRef, isEnabled, setSize }: SnugFitWatch): void {
  const fittedContent = useRef('');
  useLayoutEffect(() => {
    const element = frameRef.current;
    if (!element || !isEnabled) {
      fittedContent.current = '';
      return;
    }
    const content = element.textContent ?? '';
    const pane = readLegendPaneBox(element);
    if (content === fittedContent.current || pane.width <= 0 || pane.height <= 0) return;
    fittedContent.current = content;
    const limit = {
      width: pane.width - LEGEND_SNUG_RIGHT_MARGIN_PX,
      height: fitLegendHeight(NO_HEIGHT_LIMIT_PX, pane.height, readControlsClearance(findLegendPane(element))),
    };
    const snug = measureSnugLegendSize((frame) => measureLegendContent(element, frame), limit);
    applyLegendFrame(element, snug);
    setSize(snug);
  });
}

function applyLegendFrame(element: HTMLElement, frame: LegendSize): void {
  element.style.width = `${frame.width}px`;
  element.style.height = `${frame.height}px`;
  element.style.setProperty('--legend-font-scale', String(measureLegendFontScale(frame.width, frame.height)));
  // The layout is React state, so a frame measured before rendering needs it set by hand.
  element.dataset.layout = chooseLegendEntryDirection(frame.width, frame.height);
}

/** Lay the legend out in `frame` and read how much room its content needs. */
function measureLegendContent(element: HTMLElement, frame: LegendSize): LegendContentSize {
  // Scrollbars would take room from the content and be measured as content themselves.
  const previousOverflow = element.style.overflow;
  element.style.overflow = 'hidden';
  applyLegendFrame(element, frame);
  // scroll sizes leave the borders out, but the frame is a border box.
  const content = {
    scrollWidth: element.scrollWidth + (element.offsetWidth - element.clientWidth),
    scrollHeight: element.scrollHeight + (element.offsetHeight - element.clientHeight),
  };
  element.style.overflow = previousOverflow;
  return content;
}

function useFitDefaultHeight(
  frameRef: RefObject<HTMLDivElement | null>,
  setMaxHeight: (maxHeight: number) => void,
): void {
  useEffect(() => {
    const element = frameRef.current;
    if (!element) return undefined;
    const pane = findLegendPane(element);
    const fit = () => {
      const paneHeight = readLegendPaneBox(element).height;
      if (paneHeight <= 0) return;
      const clearance = readControlsClearance(pane);
      setMaxHeight(legendMaxHeight(paneHeight, clearance));
    };
    fit();
    const frame = window.requestAnimationFrame(fit);
    const observer = new ResizeObserver(fit);
    observer.observe(pane);
    const controls = pane.querySelector(ZOOM_CONTROLS_SELECTOR);
    if (controls) observer.observe(controls);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [frameRef, setMaxHeight]);
}

/** Room the zoom controls take at the bottom of the pane, or undefined when they are not drawn yet. */
function readControlsClearance(pane: HTMLElement): number | undefined {
  const controls = pane.querySelector(ZOOM_CONTROLS_SELECTOR);
  if (!controls) return undefined;
  return pane.getBoundingClientRect().bottom - controls.getBoundingClientRect().top + ZOOM_CONTROLS_GAP_PX;
}

function useFillPane(
  frameRef: RefObject<HTMLDivElement | null>,
  isFilling: boolean,
  setFill: (fill: LegendFill | null) => void,
): void {
  useEffect(() => {
    const element = frameRef.current;
    if (!element || !isFilling) {
      setFill(null);
      return undefined;
    }
    const measure = () => setFill(fillLegendFrame(readLegendPaneBox(element), LEGEND_FILL_MARGIN_PX));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(findLegendPane(element));
    return () => observer.disconnect();
  }, [frameRef, isFilling, setFill]);
}

type LegendResizeWatch = {
  frameRef: RefObject<HTMLDivElement | null>;
  isConcealed: boolean;
  concealedRef: { current: boolean };
  /** True while the user holds the resize grip: only then does the observed size count. */
  resizingRef: { current: boolean };
  setSize: (update: (current: LegendSize) => LegendSize) => void;
};

type LegendFrameInput = {
  frameRef: RefObject<HTMLDivElement | null>;
  offset: LegendOffset;
  size: LegendSize;
  isConcealed: boolean;
  isFilling: boolean;
  fill: LegendFill | null;
  maxHeight: number | undefined;
  resizingRef: { current: boolean };
  sizeRef: { current: LegendSize };
  concealedRef: { current: boolean };
  suppressClickRef: { current: boolean };
  setOffset: (offset: LegendOffset) => void;
  setIsConcealed: (update: (value: boolean) => boolean) => void;
  setIsUserSized: (isUserSized: boolean) => void;
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
  const { frameRef, isConcealed, concealedRef, resizingRef, setSize } = watch;
  useEffect(() => {
    const element = frameRef.current;
    if (!element || isConcealed) return undefined;
    const observer = new ResizeObserver((entries) => {
      if (resizingRef.current) rememberObservedSize(entries[0], concealedRef, setSize);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [frameRef, isConcealed, concealedRef, resizingRef, setSize]);
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
  const shown = pickShownLegendFrame(input.isFilling, input.fill, {
    offset: input.offset,
    size: input.size,
  });
  return {
    isConcealed: input.isConcealed,
    direction: chooseLegendEntryDirection(shown.size.width, shown.size.height),
    style: buildLegendFrameStyle(shown.offset, shown.size, input.isConcealed, input.maxHeight),
    onPointerDown: (event) => {
      event.stopPropagation();
      if (isOnResizeGrip(event)) holdResizeGrip(input);
      beginLegendDrag(event, session);
    },
    onToggleClick: (event) => {
      toggleConcealedLegend(event, input.suppressClickRef, input.setIsConcealed);
    },
  };
}

function holdResizeGrip(input: LegendFrameInput): void {
  input.setIsUserSized(true);
  input.resizingRef.current = true;
  const release = () => {
    input.resizingRef.current = false;
    window.removeEventListener('pointerup', release);
  };
  window.addEventListener('pointerup', release);
}

function isOnResizeGrip(event: ReactPointerEvent<HTMLDivElement>): boolean {
  if (event.target !== event.currentTarget) return false;
  return isResizeGrip(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY);
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
  maxHeight: number | undefined,
): LegendFrameStyle {
  const style: LegendFrameStyle = {
    left: offset.left,
    top: offset.top,
    '--legend-font-scale': String(measureLegendFontScale(size.width, size.height)),
  };
  if (isConcealed) return style;
  style.width = size.width;
  style.height = size.height;
  style.maxHeight = maxHeight;
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
  const target = pointerElement(event.target);
  if (!target || !isDragHandle(target, session.concealedRef.current)) return;
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

function pointerElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  if (target instanceof Node) return target.parentElement;
  return null;
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

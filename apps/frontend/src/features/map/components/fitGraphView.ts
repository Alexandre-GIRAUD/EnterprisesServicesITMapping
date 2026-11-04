import { NODE_HEIGHT, NODE_WIDTH } from '../hooks/useGraphData';
import { computeLegendFitPadding, fitAreaAspectRatio, type FitViewPadding } from './drawerFitPadding';

export const FIT_VIEW_PADDING = 0.06;

/** Inset (px) from the pane edges when deciding if a node is “on screen”. */
const VISIBILITY_PADDING_PX = 12;

type NodeLike = {
  id: string;
  position: { x: number; y: number };
  measured?: { width?: number; height?: number };
  width?: number;
  height?: number;
};

type ViewportInstance = {
  fitView: (options?: {
    padding?: FitViewPadding;
    duration?: number;
    maxZoom?: number;
    minZoom?: number;
    includeHiddenNodes?: boolean;
    nodes?: Array<{ id: string }>;
  }) => Promise<boolean> | void;
  getNodes: () => NodeLike[];
  flowToScreenPosition: (position: { x: number; y: number }) => { x: number; y: number };
};

type FitOptions = {
  padding?: FitViewPadding;
  duration?: number;
  maxZoom?: number;
  /** Fit only these nodes instead of the whole graph. */
  nodeIds?: readonly string[];
};

type EnsureVisibleOptions = {
  /** Screen-space inset for the containment check (default 12). */
  paddingPx?: number;
  duration?: number;
  /** Cap zoom-in when fitting off-screen restored nodes. */
  maxZoom?: number;
  /**
   * Positions from the just-applied layout — used when React Flow has not
   * committed the restored nodes into `getNodes()` yet.
   */
  nodeHints?: readonly NodeLike[];
};

/**
 * Fit the full diagram into the viewport after layout. Uses a double
 * requestAnimationFrame so React Flow has measured every node before computing
 * bounds — required when multiple disconnected components are packed together.
 */
export function fitGraphView(
  instance: Pick<ViewportInstance, 'fitView'> | null | undefined,
  options: FitOptions = {}
): void {
  if (!instance) return;
  const { padding = readLegendFitPadding(), duration = 250, maxZoom = 1.5, nodeIds } = options;
  const nodes = nodeIds?.map((id) => ({ id }));

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      void instance.fitView({ padding, duration, maxZoom, includeHiddenNodes: false, nodes });
    });
  });
}

/** React Flow hands out its instance, then measures the boxes, a moment after the first layout; wait for both, but not forever. */
const MAX_INSTANCE_WAIT_FRAMES = 120;

/** The legend mounts a moment after the graph; give it this many frames before fitting without it. */
const LEGEND_WAIT_FRAMES = 30;

const LEGEND_SELECTOR = '.graph-legend';
const PANE_SELECTOR = '.react-flow';
const OPEN_MENU_SELECTOR = '.map-graph-panel.is-menu-open .self-service-side-menu-shell';

/** Same as {@link fitGraphView}, for a caller whose instance may not exist yet. */
export function fitGraphViewWhenReady(
  ref: { current: Pick<ViewportInstance, 'fitView' | 'getNodes'> | null },
  options: FitOptions = {},
  framesLeft: number = MAX_INSTANCE_WAIT_FRAMES
): void {
  requestAnimationFrame(() => {
    const isWaitingForLegend = framesLeft > MAX_INSTANCE_WAIT_FRAMES - LEGEND_WAIT_FRAMES && isLegendMissing();
    if (ref.current && areNodesMeasured(ref.current) && !isWaitingForLegend) {
      fitGraphView(ref.current, options);
      return;
    }
    if (framesLeft > 0) fitGraphViewWhenReady(ref, options, framesLeft - 1);
  });
}

function isLegendMissing(): boolean {
  return typeof document !== 'undefined' && document.querySelector(LEGEND_SELECTOR) === null;
}

function areNodesMeasured(instance: Pick<ViewportInstance, 'getNodes'>): boolean {
  const nodes = instance.getNodes();
  return nodes.length > 0 && nodes.every((node) => (node.measured?.width ?? 0) > 0);
}

/** The legend's right edge inside the pane, or the plain margin when no legend is drawn. */
function readLegendFitPadding(): FitViewPadding {
  if (typeof document === 'undefined') return FIT_VIEW_PADDING;
  const pane = document.querySelector(PANE_SELECTOR);
  if (!pane) return FIT_VIEW_PADDING;
  const paneRect = pane.getBoundingClientRect();
  const legend = document.querySelector(LEGEND_SELECTOR);
  const menu = document.querySelector(OPEN_MENU_SELECTOR);
  return computeLegendFitPadding(
    legend ? legend.getBoundingClientRect().right - paneRect.left : undefined,
    menu ? paneRect.right - menu.getBoundingClientRect().left : undefined,
    paneRect.width
  );
}

/** Aspect ratio of the area the next fit fills, for packing islands to the zoom they will get. */
export function readFitAspectRatio(): number | undefined {
  const pane = typeof document === 'undefined' ? null : document.querySelector(PANE_SELECTOR);
  if (!pane) return undefined;
  const { width, height } = pane.getBoundingClientRect();
  return fitAreaAspectRatio(width, height, readLegendFitPadding());
}

function nodeSize(node: NodeLike): { width: number; height: number } {
  return {
    width: node.measured?.width ?? node.width ?? NODE_WIDTH,
    height: node.measured?.height ?? node.height ?? NODE_HEIGHT,
  };
}

/**
 * True when the node’s box is fully inside the container, inset by {@link paddingPx}.
 * Partially clipped nodes are treated as not visible.
 */
export function isNodeFullyVisibleInContainer(
  instance: Pick<ViewportInstance, 'flowToScreenPosition'>,
  container: HTMLElement,
  node: NodeLike,
  paddingPx: number = VISIBILITY_PADDING_PX
): boolean {
  const { width, height } = nodeSize(node);
  const topLeft = instance.flowToScreenPosition({ x: node.position.x, y: node.position.y });
  const bottomRight = instance.flowToScreenPosition({
    x: node.position.x + width,
    y: node.position.y + height,
  });
  const rect = container.getBoundingClientRect();
  return (
    topLeft.x >= rect.left + paddingPx &&
    topLeft.y >= rect.top + paddingPx &&
    bottomRight.x <= rect.right - paddingPx &&
    bottomRight.y <= rect.bottom - paddingPx
  );
}

function resolveTargetNodes(
  instance: ViewportInstance,
  nodeIds: readonly string[],
  nodeHints?: readonly NodeLike[]
): NodeLike[] {
  const idSet = new Set(nodeIds);
  const fromStore = instance.getNodes().filter((n) => idSet.has(n.id));
  if (fromStore.length >= idSet.size) return fromStore;

  const byId = new Map(fromStore.map((n) => [n.id, n]));
  if (nodeHints) {
    for (const hint of nodeHints) {
      if (idSet.has(hint.id) && !byId.has(hint.id)) byId.set(hint.id, hint);
    }
  }
  return nodeIds.map((id) => byId.get(id)).filter((n): n is NodeLike => n != null);
}

/**
 * After restoring nodes: if any target id is outside the current window, fit
 * **only those nodes** (not the whole graph). If all are already on screen at
 * the current zoom, leave the viewport unchanged.
 */
export function ensureNodesVisible(
  instance: ViewportInstance | null | undefined,
  container: HTMLElement | null | undefined,
  nodeIds: readonly string[],
  options: EnsureVisibleOptions = {}
): void {
  if (!instance || !container || nodeIds.length === 0) return;

  const {
    paddingPx = VISIBILITY_PADDING_PX,
    duration = 200,
    maxZoom = 1.5,
    nodeHints,
  } = options;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const targets = resolveTargetNodes(instance, nodeIds, nodeHints);
      if (targets.length === 0) return;

      if (targets.every((n) => isNodeFullyVisibleInContainer(instance, container, n, paddingPx))) {
        return;
      }

      void instance.fitView({
        nodes: targets,
        padding: FIT_VIEW_PADDING,
        duration,
        maxZoom,
        includeHiddenNodes: false,
      });
    });
  });
}

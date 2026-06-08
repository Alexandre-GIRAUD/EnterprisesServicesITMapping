export const FIT_VIEW_PADDING = 0.15;

type FitViewInstance = {
  fitView: (options?: {
    padding?: number;
    duration?: number;
    maxZoom?: number;
    includeHiddenNodes?: boolean;
  }) => Promise<boolean> | void;
};

type FitOptions = {
  padding?: number;
  duration?: number;
  maxZoom?: number;
};

/**
 * Fit the full diagram into the viewport after layout. Uses a double
 * requestAnimationFrame so React Flow has measured every node before computing
 * bounds — required when multiple disconnected components are packed together.
 */
export function fitGraphView(
  instance: FitViewInstance | null | undefined,
  options: FitOptions = {}
): void {
  if (!instance) return;
  const { padding = FIT_VIEW_PADDING, duration = 250, maxZoom = 1.5 } = options;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      void instance.fitView({ padding, duration, maxZoom, includeHiddenNodes: false });
    });
  });
}

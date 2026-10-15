/** Snap back to the viewport fit when the drag is within this many pixels of it. */
export const DIAGRAM_GROW_SNAP_PIXELS = 8;

/**
 * Dragged diagram height. `null` means the diagram fills the viewport
 * (no page scroll). A number is an explicit height taller than that fit.
 */
export function resolveNextDiagramHeight(fittedHeight: number, draggedHeight: number): number | null {
  if (draggedHeight <= fittedHeight + DIAGRAM_GROW_SNAP_PIXELS) return null;
  return Math.round(draggedHeight);
}

/** Matches the application title on the node card (`.graph-node-card__label`). */
export const APPLICATION_TITLE_FONT_SIZE_PX = 12;

export type FlowLabelVisibilityInput = {
  text: string;
  zoom: number;
  hideLabels: boolean;
  isIndirect: boolean;
  hovered: boolean;
};

/**
 * A flow label follows the application title: it stays drawn at every zoom.
 * Hover does not bring back a label the legend has hidden.
 */
export function isFlowLabelVisible(input: FlowLabelVisibilityInput): boolean {
  void input.zoom;
  void input.hovered;
  if (input.isIndirect || input.hideLabels) return false;
  return input.text.trim().length > 0;
}

/** Map coordinates. The viewport scales this; the label does not cancel that scale. */
export function flowLabelMapTransform(x: number, y: number): string {
  return `translate(-50%, -50%) translate(${x}px, ${y}px)`;
}

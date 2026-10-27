/** Matches the application title on the node card (`.graph-node-card__label`). */
export const APPLICATION_TITLE_FONT_SIZE_PX = 12;
const LABEL_ANCHOR_OFFSET = '-50%';

export type FlowLabelVisibilityInput = {
  text: string;
  zoom: number;
  shouldHideLabels: boolean;
  isIndirect: boolean;
  isHovered: boolean;
};

/**
 * A flow label follows the application title: it stays drawn at every zoom.
 * Hover does not bring back a label the legend has hidden.
 */
export function isFlowLabelVisible(input: FlowLabelVisibilityInput): boolean {
  void input.zoom;
  void input.isHovered;
  if (input.isIndirect || input.shouldHideLabels) return false;
  return input.text.trim().length > 0;
}

/** Map coordinates. The viewport scales this; the label does not cancel that scale. */
export function buildFlowLabelMapTransform(x: number, y: number): string {
  return `translate(${LABEL_ANCHOR_OFFSET}, ${LABEL_ANCHOR_OFFSET}) translate(${x}px, ${y}px)`;
}

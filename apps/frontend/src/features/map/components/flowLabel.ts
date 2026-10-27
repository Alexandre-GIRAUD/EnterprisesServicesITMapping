/** Matches the application title on the node card (`.graph-node-card__label`). */
export const APPLICATION_TITLE_FONT_SIZE_PX = 12;
const LABEL_ANCHOR_OFFSET = '-50%';

type FlowLabelVisibilityInput = {
  text: string;
  shouldHideLabels: boolean;
  isIndirect: boolean;
  isEditing: boolean;
};

/**
 * A flow label follows the application title, so zoom takes no part in it,
 * and hover cannot bring back a label the legend has hidden. An empty label
 * shows while it is edited, since that is how a flow gets its first name.
 */
export function isFlowLabelVisible(input: FlowLabelVisibilityInput): boolean {
  if (input.isIndirect) return false;
  if (input.isEditing) return true;
  if (input.shouldHideLabels) return false;
  return input.text.trim().length > 0;
}

/** Map coordinates. The viewport scales this; the label does not cancel that scale. */
export function buildFlowLabelMapTransform(x: number, y: number): string {
  return `translate(${LABEL_ANCHOR_OFFSET}, ${LABEL_ANCHOR_OFFSET}) translate(${x}px, ${y}px)`;
}

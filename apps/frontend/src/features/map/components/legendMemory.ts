import type { LegendOffset, LegendSize } from './legendFrame.ts';

export type RememberedLegend = {
  offset: LegendOffset;
  size: LegendSize;
  /** The size was dragged by hand; otherwise it is the snug default. */
  isUserSized: boolean;
  /** Folded into its launcher, so the next view shows it folded too. */
  isConcealed: boolean;
};

let remembered: RememberedLegend | null = null;

/** Outlives the legend component: the module view replaces the graph screen, then it comes back. */
export function rememberLegend(legend: RememberedLegend): void {
  remembered = legend;
}

export function recallLegend(): RememberedLegend | null {
  return remembered;
}

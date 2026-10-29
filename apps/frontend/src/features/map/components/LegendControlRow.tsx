import type { ReactNode } from 'react';

type Props = {
  label: string;
  /** The select; kept short so the row stays on one line. */
  children: ReactNode;
  /** Pinned to the end of the line, e.g. the swatch and color picker. */
  trailing?: ReactNode;
};

/** One legend edit line: label, short dropdown, then an optional end-of-line control. */
export function LegendControlRow({ label, children, trailing }: Props) {
  return (
    <div className="graph-legend__control graph-legend__control--row">
      <span className="graph-legend__control-label">{label}</span>
      {children}
      {trailing ? <span className="graph-legend__control-end">{trailing}</span> : null}
    </div>
  );
}

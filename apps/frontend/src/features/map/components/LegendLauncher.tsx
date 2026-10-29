type Props = {
  onClick: (event: { preventDefault: () => void }) => void;
};

/** Collapsed legend: a square "L" that sits above the zoom controls and reopens the legend. */
export function LegendLauncher({ onClick }: Props) {
  return (
    <button
      type="button"
      className="graph-legend__toggle graph-legend__show"
      aria-label="Show legend"
      title="Show legend"
      onClick={onClick}
    >
      L
    </button>
  );
}

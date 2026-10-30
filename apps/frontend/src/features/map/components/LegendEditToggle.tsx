type Props = {
  isEditing: boolean;
  onEdit: () => void;
  onApply: () => void;
};

/** Edit opens the legend controls; Apply keeps what was chosen and closes them. */
export function LegendEditToggle({ isEditing, onEdit, onApply }: Props) {
  if (isEditing) {
    return (
      <button
        type="button"
        className="graph-filter-compact-btn graph-filter-compact-btn--primary"
        onClick={onApply}
      >
        Apply
      </button>
    );
  }
  return (
    <button type="button" className="graph-legend__toggle" aria-label="Edit" title="Edit" onClick={onEdit}>
      Edit
    </button>
  );
}

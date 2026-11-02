type Props = {
  label: string;
  /** Lexicon of business objects. */
  options: string[];
  selected: string[];
  disabled: boolean;
  onChange: (selected: string[]) => void;
};

const NO_OBJECT_HINT = 'No business object yet. Add some to the application first.';

/**
 * Pick business objects from the application lexicon. A value already stored but no longer in the
 * lexicon stays listed, so saving never drops it silently.
 */
export function ObjectPicker({ label, options, selected, disabled, onChange }: Props) {
  const choices = [...options, ...selected.filter((value) => !options.includes(value))];

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }

  return (
    <fieldset className="graph-drawer-field graph-drawer-fieldset">
      <legend className="graph-drawer-field-label">{label}</legend>
      {choices.length === 0 ? (
        <p className="graph-drawer-field-hint">{NO_OBJECT_HINT}</p>
      ) : (
        <div className="graph-drawer-region-checkboxes">
          {choices.map((value) => (
            <label key={value} className="graph-drawer-checkbox-row">
              <input
                type="checkbox"
                checked={selected.includes(value)}
                disabled={disabled}
                onChange={() => toggle(value)}
              />
              <span>{value}</span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

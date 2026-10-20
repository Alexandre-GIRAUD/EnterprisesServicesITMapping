import type { DataModelFieldDto } from '@/types/api';
import { dedupeAttributeValues, storedAttributeList } from '../utils/attributeValue';

type AttributeValueControlProps = {
  field: DataModelFieldDto;
  value: string | string[];
  disabled: boolean;
  onChange: (next: string | string[]) => void;
};

export function AttributeValueControl({
  field,
  value,
  disabled,
  onChange,
}: AttributeValueControlProps) {
  const allowed = field.allowedValues ?? [];
  const multiple = Boolean(field.multiple);

  if (!multiple) {
    const text = typeof value === 'string' ? value : (storedAttributeList(value)[0] ?? '');
    return (
      <label className="graph-drawer-field">
        <span className="graph-drawer-field-label">{field.label || field.key}</span>
        {allowed.length > 0 ? (
          <select
            className="graph-drawer-input"
            value={text}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
          >
            <option value="">Not set</option>
            {allowed.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            {text && !allowed.includes(text) ? (
              <option value={text}>{text} (current)</option>
            ) : null}
          </select>
        ) : (
          <input
            className="graph-drawer-input"
            type="text"
            value={text}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
          />
        )}
        {field.description ? (
          <span className="graph-drawer-field-hint">{field.description}</span>
        ) : null}
      </label>
    );
  }

  if (allowed.length > 0) {
    const selected = dedupeAttributeValues(storedAttributeList(value));
    return (
      <fieldset className="graph-drawer-field graph-drawer-fieldset">
        <legend className="graph-drawer-field-label">{field.label || field.key}</legend>
        <div className="graph-drawer-region-checkboxes">
          {allowed.map((option) => {
            const checked = selected.some((item) => item.toLowerCase() === option.toLowerCase());
            return (
              <label key={option} className="graph-drawer-checkbox-row">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => {
                    const next = checked
                      ? selected.filter((item) => item.toLowerCase() !== option.toLowerCase())
                      : [...selected, option];
                    onChange(next);
                  }}
                />
                <span>{option}</span>
              </label>
            );
          })}
        </div>
        {field.description ? (
          <span className="graph-drawer-field-hint">{field.description}</span>
        ) : null}
      </fieldset>
    );
  }

  const rows = Array.isArray(value) ? value : storedAttributeList(value);
  return (
    <fieldset className="graph-drawer-field graph-drawer-fieldset">
      <legend className="graph-drawer-field-label">{field.label || field.key}</legend>
      {rows.map((item, index) => (
        <div className="graph-drawer-multi-row" key={`${field.key}-${index}`}>
          <input
            className="graph-drawer-input"
            type="text"
            value={item}
            disabled={disabled}
            aria-label={`${field.label || field.key} value ${index + 1}`}
            onChange={(event) => {
              const next = [...rows];
              next[index] = event.target.value;
              onChange(next);
            }}
          />
          <button
            type="button"
            className="graph-drawer-text-button is-danger"
            disabled={disabled}
            onClick={() => onChange(rows.filter((_, itemIndex) => itemIndex !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="graph-drawer-text-button"
        disabled={disabled}
        onClick={() => onChange([...rows, ''])}
      >
        Add value
      </button>
      {field.description ? (
        <span className="graph-drawer-field-hint">{field.description}</span>
      ) : null}
    </fieldset>
  );
}

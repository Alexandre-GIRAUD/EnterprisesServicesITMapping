import type { BreachConditionDto, BreachSubject, DataModelFieldDto } from '@/types/api';
import { DataModelIcon } from '@/features/datamodel/components/DataModelIcons';
import { attributeOptions, needsValue, OPERATOR_OPTIONS, scopeOptions } from '../breachRules';

type BreachConditionRowProps = {
  condition: BreachConditionDto;
  subject: BreachSubject;
  fields: DataModelFieldDto[];
  isReadOnly: boolean;
  canRemove: boolean;
  onChange: (condition: BreachConditionDto) => void;
  onRemove: () => void;
};

/** One condition, read as a sentence: [scope] [attribute] [operator] [value]. */
export function BreachConditionRow({
  condition,
  subject,
  fields,
  isReadOnly,
  canRemove,
  onChange,
  onRemove,
}: BreachConditionRowProps) {
  const attributes = attributeOptions(fields, condition.scope);

  function changeScope(scope: BreachConditionDto['scope']) {
    const nextAttributes = attributeOptions(fields, scope);
    const keepsAttribute = nextAttributes.some((option) => option.key === condition.attribute);
    onChange({ ...condition, scope, attribute: keepsAttribute ? condition.attribute : nextAttributes[0]?.key ?? '' });
  }

  return (
    <div className="breach-condition">
      <select
        className="data-model-input"
        aria-label="Scope"
        value={condition.scope}
        disabled={isReadOnly}
        onChange={(event) => changeScope(event.target.value as BreachConditionDto['scope'])}
      >
        {scopeOptions(subject).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <select
        className="data-model-input"
        aria-label="Attribute"
        value={condition.attribute}
        disabled={isReadOnly}
        onChange={(event) => onChange({ ...condition, attribute: event.target.value })}
      >
        {attributes.length === 0 ? <option value="">No attribute in the Data Model</option> : null}
        {attributes.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
      <select
        className="data-model-input breach-condition-operator"
        aria-label="Operator"
        value={condition.operator}
        disabled={isReadOnly}
        onChange={(event) => onChange({ ...condition, operator: event.target.value as BreachConditionDto['operator'] })}
      >
        {OPERATOR_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {needsValue(condition.operator) ? (
        <input
          className="data-model-input"
          aria-label="Value"
          placeholder="Value, e.g. 100k"
          value={condition.value}
          readOnly={isReadOnly}
          onChange={(event) => onChange({ ...condition, value: event.target.value })}
        />
      ) : (
        <span className="breach-condition-novalue" aria-hidden="true" />
      )}
      {isReadOnly ? null : (
        <button
          type="button"
          className="data-model-icon-btn"
          aria-label="Remove condition"
          disabled={!canRemove}
          onClick={onRemove}
        >
          <DataModelIcon name="trash" />
        </button>
      )}
    </div>
  );
}

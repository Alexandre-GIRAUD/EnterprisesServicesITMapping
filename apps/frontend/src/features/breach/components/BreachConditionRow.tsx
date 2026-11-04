import type { BreachConditionDto, BreachSubject, DataModelFieldDto } from '@/types/api';
import { DataModelIcon } from '@/features/datamodel/components/DataModelIcons';
import { attributeOptions, isValueRequired, OPERATOR_OPTIONS, scopeOptions } from '../breachRules';

type BreachConditionRowProps = {
  condition: BreachConditionDto;
  subject: BreachSubject;
  fields: DataModelFieldDto[];
  isReadOnly: boolean;
  canRemove: boolean;
  issue: string | null;
  onChange: (condition: BreachConditionDto) => void;
  onRemove: () => void;
};

function withScope(condition: BreachConditionDto, scope: BreachConditionDto['scope'], fields: DataModelFieldDto[]) {
  const nextAttributes = attributeOptions(fields, scope);
  const isAttributeKept = nextAttributes.some((option) => option.key === condition.attribute);
  return { ...condition, scope, attribute: isAttributeKept ? condition.attribute : nextAttributes[0]?.key ?? '' };
}

/** One condition, read as a sentence: [scope] [attribute] [operator] [value]. */
export function BreachConditionRow(props: BreachConditionRowProps) {
  const { condition, subject, fields, isReadOnly, canRemove, issue, onChange, onRemove } = props;
  const attributes = attributeOptions(fields, condition.scope);

  return (
    <div className="breach-condition-field">
      <div className="breach-condition">
        <select
          className="data-model-input"
          aria-label="Scope"
          value={condition.scope}
          disabled={isReadOnly}
          onChange={(event) => onChange(withScope(condition, event.target.value as BreachConditionDto['scope'], fields))}
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
        {isValueRequired(condition.operator) ? (
          <input
            className={`data-model-input${issue ? ' is-invalid' : ''}`}
            aria-label="Value"
            aria-invalid={issue ? true : undefined}
            placeholder="Value, e.g. 100k"
            value={condition.value}
            readOnly={isReadOnly}
            onChange={(event) => onChange({ ...condition, value: event.target.value })}
          />
        ) : (
          <span aria-hidden="true" />
        )}
        {isReadOnly ? null : (
          <button type="button" className="data-model-icon-btn" aria-label="Remove condition" disabled={!canRemove} onClick={onRemove}>
            <DataModelIcon name="trash" />
          </button>
        )}
      </div>
      {issue ? (
        <p className="breach-field-issue" role="alert">
          {issue}
        </p>
      ) : null}
    </div>
  );
}

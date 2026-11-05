import type { BreachConditionDto, BreachGroupDto, BreachSubject, DataModelFieldDto } from '@/types/api';
import { DataModelIcon } from '@/features/datamodel/components/DataModelIcons';
import { emptyCondition, type DraftIssue } from '../breachRules';
import { BreachCombinatorJoin } from './BreachCombinatorJoin';
import { BreachConditionRow } from './BreachConditionRow';

type BreachGroupCardProps = {
  group: BreachGroupDto;
  groupIndex: number;
  subject: BreachSubject;
  fields: DataModelFieldDto[];
  isReadOnly: boolean;
  isLastCondition: boolean;
  issue: DraftIssue | null;
  /** Null removes the group (its last condition was removed). */
  onChange: (group: BreachGroupDto | null) => void;
};

function issueAt(issue: DraftIssue | null, groupIndex: number, conditionIndex: number): string | null {
  if (!issue || issue.at === 'name') return null;
  const isHere = issue.at.groupIndex === groupIndex && issue.at.conditionIndex === conditionIndex;
  return isHere ? issue.message : null;
}

/** One group of conditions joined by its own AND / OR. */
export function BreachGroupCard(props: BreachGroupCardProps) {
  const { group, groupIndex, subject, fields, isReadOnly, isLastCondition, issue, onChange } = props;

  function replaceCondition(conditionIndex: number, condition: BreachConditionDto) {
    onChange({ ...group, conditions: group.conditions.map((current, index) => (index === conditionIndex ? condition : current)) });
  }

  function removeCondition(conditionIndex: number) {
    const conditions = group.conditions.filter((_, index) => index !== conditionIndex);
    onChange(conditions.length > 0 ? { ...group, conditions } : null);
  }

  return (
    <section className="breach-group" aria-label={`Group ${groupIndex + 1}`}>
      {group.conditions.map((condition, conditionIndex) => (
        <div key={conditionIndex} className="breach-condition-slot">
          <BreachCombinatorJoin
            position={conditionIndex}
            value={group.combinator}
            label={`Inside group ${groupIndex + 1}`}
            isReadOnly={isReadOnly}
            onChange={(combinator) => onChange({ ...group, combinator })}
          />
          <BreachConditionRow
            condition={condition}
            subject={subject}
            fields={fields}
            isReadOnly={isReadOnly}
            canRemove={!isLastCondition}
            issue={issueAt(issue, groupIndex, conditionIndex)}
            onChange={(next) => replaceCondition(conditionIndex, next)}
            onRemove={() => removeCondition(conditionIndex)}
          />
        </div>
      ))}
      {isReadOnly ? null : (
        <button
          type="button"
          className="breach-text-btn"
          onClick={() => onChange({ ...group, conditions: [...group.conditions, emptyCondition(subject, fields)] })}
        >
          <DataModelIcon name="plus" />
          Add condition
        </button>
      )}
    </section>
  );
}

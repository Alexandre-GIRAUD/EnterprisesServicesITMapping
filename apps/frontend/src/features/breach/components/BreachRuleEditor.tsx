import type {
  BreachCombinator,
  BreachConditionDto,
  BreachGroupDto,
  BreachRuleRequest,
  BreachSubject,
  DataModelFieldDto,
} from '@/types/api';
import { DataModelIcon } from '@/features/datamodel/components/DataModelIcons';
import { changeSubject, emptyCondition, SUBJECT_LABELS } from '../breachRules';
import { BreachConditionRow } from './BreachConditionRow';

const SUBJECTS: BreachSubject[] = ['APPLICATION', 'FLOW'];
const COMBINATORS: BreachCombinator[] = ['AND', 'OR'];

type BreachRuleEditorProps = {
  draft: BreachRuleRequest;
  fields: DataModelFieldDto[];
  isReadOnly: boolean;
  onChange: (draft: BreachRuleRequest) => void;
};

function CombinatorToggle({
  value,
  label,
  isReadOnly,
  onChange,
}: {
  value: BreachCombinator;
  label: string;
  isReadOnly: boolean;
  onChange: (value: BreachCombinator) => void;
}) {
  return (
    <div className="breach-combinator" role="radiogroup" aria-label={label}>
      {COMBINATORS.map((combinator) => (
        <button
          key={combinator}
          type="button"
          role="radio"
          aria-checked={value === combinator}
          className={`breach-combinator-btn${value === combinator ? ' is-active' : ''}`}
          disabled={isReadOnly}
          onClick={() => onChange(combinator)}
        >
          {combinator}
        </button>
      ))}
    </div>
  );
}

/** Name, subject, and the two-level condition tree of one rule. */
export function BreachRuleEditor({ draft, fields, isReadOnly, onChange }: BreachRuleEditorProps) {
  const groups = draft.definition.groups;

  function setGroups(nextGroups: BreachGroupDto[]) {
    onChange({ ...draft, definition: { ...draft.definition, groups: nextGroups } });
  }

  function updateGroup(groupIndex: number, group: BreachGroupDto) {
    setGroups(groups.map((current, index) => (index === groupIndex ? group : current)));
  }

  function updateCondition(groupIndex: number, conditionIndex: number, condition: BreachConditionDto) {
    const group = groups[groupIndex];
    updateGroup(groupIndex, {
      ...group,
      conditions: group.conditions.map((current, index) => (index === conditionIndex ? condition : current)),
    });
  }

  function removeCondition(groupIndex: number, conditionIndex: number) {
    const group = groups[groupIndex];
    const conditions = group.conditions.filter((_, index) => index !== conditionIndex);
    if (conditions.length === 0) {
      setGroups(groups.filter((_, index) => index !== groupIndex));
      return;
    }
    updateGroup(groupIndex, { ...group, conditions });
  }

  function addCondition(groupIndex: number) {
    const group = groups[groupIndex];
    updateGroup(groupIndex, { ...group, conditions: [...group.conditions, emptyCondition(draft.subject, fields)] });
  }

  function addGroup() {
    setGroups([...groups, { combinator: 'AND', conditions: [emptyCondition(draft.subject, fields)] }]);
  }

  function switchSubject(subject: BreachSubject) {
    if (subject === draft.subject) return;
    const result = changeSubject(draft, subject, fields);
    const plural = result.removed === 1 ? 'condition' : 'conditions';
    if (result.removed > 0 && !window.confirm(`Switching to ${SUBJECT_LABELS[subject]} removes ${result.removed} ${plural}. Continue?`)) {
      return;
    }
    onChange(result.draft);
  }

  const totalConditions = groups.reduce((count, group) => count + group.conditions.length, 0);

  return (
    <div className="breach-editor">
      <div className="breach-editor-head">
        <label className="data-model-label breach-editor-name">
          Rule name
          <input
            className="data-model-input"
            value={draft.name}
            placeholder="e.g. Applications over budget"
            readOnly={isReadOnly}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
          />
        </label>
        <div className="data-model-label">
          Flag
          <div className="graph-display-toggle breach-subject-toggle" role="tablist" aria-label="Rule subject">
            {SUBJECTS.map((subject) => (
              <button
                key={subject}
                type="button"
                role="tab"
                aria-selected={draft.subject === subject}
                className={`graph-display-toggle-btn${draft.subject === subject ? ' is-active' : ''}`}
                disabled={isReadOnly}
                onClick={() => switchSubject(subject)}
              >
                <span className="graph-display-toggle-label">{SUBJECT_LABELS[subject]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="breach-groups">
        {groups.map((group, groupIndex) => (
          <div key={groupIndex} className="breach-group-slot">
            {groupIndex > 0 ? (
              <div className="breach-group-join">
                {groupIndex === 1 ? (
                  <CombinatorToggle
                    value={draft.definition.combinator}
                    label="Between groups"
                    isReadOnly={isReadOnly}
                    onChange={(combinator) => onChange({ ...draft, definition: { ...draft.definition, combinator } })}
                  />
                ) : (
                  <span className="breach-join-pill">{draft.definition.combinator}</span>
                )}
              </div>
            ) : null}
            <section className="breach-group" aria-label={`Group ${groupIndex + 1}`}>
              {group.conditions.map((condition, conditionIndex) => (
                <div key={conditionIndex} className="breach-condition-slot">
                  {conditionIndex > 0 ? (
                    conditionIndex === 1 ? (
                      <CombinatorToggle
                        value={group.combinator}
                        label={`Inside group ${groupIndex + 1}`}
                        isReadOnly={isReadOnly}
                        onChange={(combinator) => updateGroup(groupIndex, { ...group, combinator })}
                      />
                    ) : (
                      <span className="breach-join-pill">{group.combinator}</span>
                    )
                  ) : null}
                  <BreachConditionRow
                    condition={condition}
                    subject={draft.subject}
                    fields={fields}
                    isReadOnly={isReadOnly}
                    canRemove={totalConditions > 1}
                    onChange={(next) => updateCondition(groupIndex, conditionIndex, next)}
                    onRemove={() => removeCondition(groupIndex, conditionIndex)}
                  />
                </div>
              ))}
              {isReadOnly ? null : (
                <button type="button" className="breach-text-btn" onClick={() => addCondition(groupIndex)}>
                  <DataModelIcon name="plus" />
                  Add condition
                </button>
              )}
            </section>
          </div>
        ))}
      </div>

      {isReadOnly ? null : (
        <button type="button" className="data-model-add-row breach-add-group" onClick={addGroup}>
          <DataModelIcon name="plus" />
          Add group
        </button>
      )}
    </div>
  );
}

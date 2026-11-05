import type { BreachGroupDto, BreachRuleRequest, BreachSubject, DataModelFieldDto } from '@/types/api';
import { DataModelIcon } from '@/features/datamodel/components/DataModelIcons';
import { changeSubject, newRuleDraft, SUBJECT_LABELS, type DraftIssue } from '../breachRules';
import { BreachCombinatorJoin } from './BreachCombinatorJoin';
import { BreachGroupCard } from './BreachGroupCard';

const SUBJECTS: BreachSubject[] = ['APPLICATION', 'FLOW'];

type BreachRuleEditorProps = {
  draft: BreachRuleRequest;
  fields: DataModelFieldDto[];
  isReadOnly: boolean;
  issue: DraftIssue | null;
  onChange: (draft: BreachRuleRequest) => void;
};

function SubjectToggle({ draft, fields, isReadOnly, onChange }: Omit<BreachRuleEditorProps, 'issue'>) {
  function switchSubject(subject: BreachSubject) {
    if (subject === draft.subject) return;
    const result = changeSubject(draft, subject, fields);
    const noun = result.removed === 1 ? 'condition' : 'conditions';
    const isConfirmed =
      result.removed === 0 ||
      window.confirm(`Switching to ${SUBJECT_LABELS[subject]} removes ${result.removed} ${noun}. Continue?`);
    if (isConfirmed) onChange(result.draft);
  }

  return (
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
  );
}

/** Name, subject, and the two-level condition tree of one rule. */
export function BreachRuleEditor({ draft, fields, isReadOnly, issue, onChange }: BreachRuleEditorProps) {
  const groups = draft.definition.groups;
  const totalConditions = groups.reduce((count, group) => count + group.conditions.length, 0);
  const nameIssue = issue?.at === 'name' ? issue.message : null;

  function replaceGroup(groupIndex: number, group: BreachGroupDto | null) {
    const nextGroups = groups.flatMap((current, index) => (index !== groupIndex ? [current] : group ? [group] : []));
    onChange({ ...draft, definition: { ...draft.definition, groups: nextGroups } });
  }

  function addGroup() {
    const [freshGroup] = newRuleDraft(draft.subject, fields).definition.groups;
    onChange({ ...draft, definition: { ...draft.definition, groups: [...groups, freshGroup] } });
  }

  return (
    <div className="breach-editor">
      <div className="breach-editor-head">
        <label className="data-model-label breach-editor-name">
          Rule name
          <input
            className={`data-model-input${nameIssue ? ' is-invalid' : ''}`}
            value={draft.name}
            placeholder="e.g. Applications over budget"
            readOnly={isReadOnly}
            aria-invalid={nameIssue ? true : undefined}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
          />
          {nameIssue ? (
            <span className="breach-field-issue" role="alert">
              {nameIssue}
            </span>
          ) : null}
        </label>
        <SubjectToggle draft={draft} fields={fields} isReadOnly={isReadOnly} onChange={onChange} />
      </div>

      <div className="breach-groups">
        {groups.map((group, groupIndex) => (
          <div key={groupIndex} className="breach-group-slot">
            <div className="breach-group-join">
              <BreachCombinatorJoin
                position={groupIndex}
                value={draft.definition.combinator}
                label="Between groups"
                isReadOnly={isReadOnly}
                onChange={(combinator) => onChange({ ...draft, definition: { ...draft.definition, combinator } })}
              />
            </div>
            <BreachGroupCard
              group={group}
              groupIndex={groupIndex}
              subject={draft.subject}
              fields={fields}
              isReadOnly={isReadOnly}
              isLastCondition={totalConditions === 1}
              issue={issue}
              onChange={(next) => replaceGroup(groupIndex, next)}
            />
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

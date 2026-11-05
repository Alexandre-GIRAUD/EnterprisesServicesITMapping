import type { BreachRuleDto } from '@/types/api';
import { SUBJECT_LABELS } from '../breachRules';
import { FlameIcon } from './FlameIcon';

type BreachRuleListProps = {
  rules: BreachRuleDto[];
  selectedId: string | null;
  /** Name of an unsaved new rule, listed last; null when none is being drafted. */
  newRuleName: string | null;
  onSelect: (rule: BreachRuleDto) => void;
};

function RuleItem({ rule, isSelected, onSelect }: { rule: BreachRuleDto; isSelected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      className={`breach-rule-item${isSelected ? ' is-selected' : ''}`}
      aria-current={isSelected ? 'true' : undefined}
      onClick={onSelect}
    >
      <span className="breach-rule-item-name">{rule.name}</span>
      <span className="breach-rule-item-meta">
        <span className="data-model-chip">{SUBJECT_LABELS[rule.subject]}</span>
        <span className={`breach-count${rule.breachCount > 0 ? ' is-active' : ''}`}>
          <FlameIcon size="inline" />
          {rule.breachCount}
        </span>
        {rule.unknownCount > 0 ? (
          <span className="breach-unknown-count" title="Not evaluable">
            ? {rule.unknownCount}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function BreachRuleList({ rules, selectedId, newRuleName, onSelect }: BreachRuleListProps) {
  return (
    <nav className="breach-rule-list" aria-label="Breach rules">
      {rules.map((rule) => (
        <RuleItem key={rule.id} rule={rule} isSelected={rule.id === selectedId} onSelect={() => onSelect(rule)} />
      ))}
      {newRuleName !== null ? (
        <span className="breach-rule-item is-selected" aria-current="true">
          <span className="breach-rule-item-name">{newRuleName || 'New rule'}</span>
          <span className="breach-rule-item-meta">
            <span className="data-model-chip is-unsaved">Unsaved</span>
          </span>
        </span>
      ) : null}
    </nav>
  );
}

export function BreachEmptyState({ isAdmin, onCreate }: { isAdmin: boolean; onCreate: () => void }) {
  return (
    <div className="breach-empty" role="status">
      <span className="breach-empty-mark" aria-hidden="true">
        <FlameIcon size="feature" />
      </span>
      <div>
        <p className="breach-empty-title">No rule yet.</p>
        <p className="data-model-lead">
          A rule flags what breaks your standards, for example every application whose cost is over 100k.
        </p>
      </div>
      {isAdmin ? (
        <button type="button" className="data-model-primary-btn" onClick={onCreate}>
          Create your first rule
        </button>
      ) : null}
    </div>
  );
}

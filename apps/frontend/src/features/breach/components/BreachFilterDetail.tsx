import { useEffect, useState } from 'react';
import type { BreachRuleDto } from '@/types/api';
import { listBreachRules } from '../api/breachApi';
import { ANY_BREACH_RULE, breachFilterLabel, SUBJECT_LABELS } from '../breachRules';
import { FlameIcon } from './FlameIcon';

/** Breach rules for the map filter; loaded once per drawer, empty while loading or on error. */
export function useBreachRuleChoices(isEnabled: boolean): BreachRuleDto[] {
  const [rules, setRules] = useState<BreachRuleDto[]>([]);
  useEffect(() => {
    if (!isEnabled) return undefined;
    let cancelled = false;
    listBreachRules()
      .then((loaded) => {
        if (!cancelled) setRules(loaded);
      })
      .catch(() => {
        if (!cancelled) setRules([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isEnabled]);
  return rules;
}

type BreachFilterProps = {
  rules: BreachRuleDto[];
  selected: string[];
};

/** Root row of the Filters drawer. */
export function BreachFilterRow({ rules, selected, onOpen }: BreachFilterProps & { onOpen: () => void }) {
  return (
    <div className="graph-filter-root-row">
      <button type="button" className="graph-filter-root-row-main" onClick={onOpen}>
        <span className="graph-filter-root-row-title breach-filter-title">
          <FlameIcon size={14} />
          Breach
        </span>
        <span className={selected.length > 0 ? 'graph-filter-status is-active' : 'graph-filter-status'}>
          {breachFilterLabel(selected, rules)}
        </span>
      </button>
      <button type="button" className="graph-filter-drill-btn" onClick={onOpen} aria-label="Choose breach rules">
        ›
      </button>
    </div>
  );
}

/** Detail view: "any rule" or a choice of rules. Nothing checked means no breach filter. */
export function BreachFilterDetail({
  rules,
  selected,
  onToggle,
}: BreachFilterProps & { onToggle: (selector: string) => void }) {
  return (
    <div className="graph-drawer-region-checkboxes graph-filter-detail-list">
      <p className="graph-filter-hint">Keep only what is in breach. Flows keep their two applications.</p>
      <label className="graph-drawer-checkbox-row graph-filter-select-all-row">
        <input
          type="checkbox"
          checked={selected.includes(ANY_BREACH_RULE)}
          onChange={() => onToggle(ANY_BREACH_RULE)}
        />
        <span>In breach (any rule)</span>
      </label>
      {rules.map((rule) => (
        <label key={rule.id} className="graph-drawer-checkbox-row">
          <input type="checkbox" checked={selected.includes(rule.id)} onChange={() => onToggle(rule.id)} />
          <span className="graph-filter-option-label" title={rule.name}>
            {rule.name}
          </span>
          <span className="graph-filter-status">{SUBJECT_LABELS[rule.subject]}</span>
        </label>
      ))}
    </div>
  );
}

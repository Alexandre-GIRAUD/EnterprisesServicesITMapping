import { useEffect, useState } from 'react';
import { getBreachSummary, listBreachRules } from './api/breachApi';

/** Rule names by application id and by flow id, for the flames and colours on the map. */
export type BreachMarks = {
  applications: ReadonlyMap<string, string[]>;
  flows: ReadonlyMap<string, string[]>;
};

const NO_MARKS: BreachMarks = { applications: new Map(), flows: new Map() };

function namesById(ruleIdsById: Record<string, string[]>, nameOf: Map<string, string>): Map<string, string[]> {
  return new Map(
    Object.entries(ruleIdsById).map(([id, ruleIds]) => [id, ruleIds.map((ruleId) => nameOf.get(ruleId) ?? ruleId)])
  );
}

/**
 * Reloads whenever `reloadKey` changes (each graph load), so a Change accepted elsewhere shows up.
 * Marks stay empty when the map is not the live graph or when the server cannot be reached.
 */
export function useBreachMarks(isEnabled: boolean, reloadKey: unknown): BreachMarks {
  const [marks, setMarks] = useState<BreachMarks>(NO_MARKS);
  useEffect(() => {
    if (!isEnabled) {
      setMarks(NO_MARKS);
      return undefined;
    }
    let cancelled = false;
    Promise.all([listBreachRules(), getBreachSummary()])
      .then(([rules, summary]) => {
        if (cancelled) return;
        const nameOf = new Map(rules.map((rule) => [rule.id, rule.name]));
        setMarks({ applications: namesById(summary.applications, nameOf), flows: namesById(summary.flows, nameOf) });
      })
      .catch(() => {
        if (!cancelled) setMarks(NO_MARKS);
      });
    return () => {
      cancelled = true;
    };
  }, [isEnabled, reloadKey]);
  return marks;
}

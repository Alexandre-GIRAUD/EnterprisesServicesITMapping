import { useEffect, useState } from 'react';
import { getBreachSummary } from './api/breachApi';

/** Rule names by application id and by flow id, for the flames and colours on the map. */
export type BreachMarks = {
  applications: ReadonlyMap<string, string[]>;
  flows: ReadonlyMap<string, string[]>;
};

const NO_MARKS: BreachMarks = { applications: new Map(), flows: new Map() };

function mapRuleNames(ruleIdsById: Record<string, string[]>, ruleNames: Record<string, string>): Map<string, string[]> {
  return new Map(
    Object.entries(ruleIdsById).map(([id, ruleIds]) => [id, ruleIds.map((ruleId) => ruleNames[ruleId] ?? ruleId)])
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
    let isCancelled = false;
    getBreachSummary()
      .then((summary) => {
        if (isCancelled) return;
        setMarks({
          applications: mapRuleNames(summary.applications, summary.ruleNames),
          flows: mapRuleNames(summary.flows, summary.ruleNames),
        });
      })
      .catch(() => {
        if (!isCancelled) setMarks(NO_MARKS);
      });
    return () => {
      isCancelled = true;
    };
  }, [isEnabled, reloadKey]);
  return marks;
}

import { useEffect, useState } from 'react';
import type { BreachRuleDto } from '@/types/api';
import { listBreachRules } from './api/breachApi';

/**
 * Breach rules for the map filter, loaded once per drawer. `null` while loading or when the server
 * cannot be reached, so callers never mistake "not loaded yet" for "no rule".
 */
export function useBreachRuleChoices(isEnabled: boolean): BreachRuleDto[] | null {
  const [rules, setRules] = useState<BreachRuleDto[] | null>(null);
  useEffect(() => {
    if (!isEnabled) return undefined;
    let isCancelled = false;
    listBreachRules()
      .then((loaded) => {
        if (!isCancelled) setRules(loaded);
      })
      .catch(() => {
        if (!isCancelled) setRules(null);
      });
    return () => {
      isCancelled = true;
    };
  }, [isEnabled]);
  return rules;
}

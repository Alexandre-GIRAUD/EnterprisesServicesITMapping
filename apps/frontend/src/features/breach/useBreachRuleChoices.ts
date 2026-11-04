import { useEffect, useState } from 'react';
import type { BreachRuleDto } from '@/types/api';
import { listBreachRules } from './api/breachApi';

/** Breach rules for the map filter; loaded once per drawer, empty while loading or on error. */
export function useBreachRuleChoices(isEnabled: boolean): BreachRuleDto[] {
  const [rules, setRules] = useState<BreachRuleDto[]>([]);
  useEffect(() => {
    if (!isEnabled) return undefined;
    let isCancelled = false;
    listBreachRules()
      .then((loaded) => {
        if (!isCancelled) setRules(loaded);
      })
      .catch(() => {
        if (!isCancelled) setRules([]);
      });
    return () => {
      isCancelled = true;
    };
  }, [isEnabled]);
  return rules;
}

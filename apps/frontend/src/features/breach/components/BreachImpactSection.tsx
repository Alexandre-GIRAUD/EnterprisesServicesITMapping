import { useEffect, useState } from 'react';
import type { BreachImpactDto, BreachImpactResponseDto } from '@/types/api';
import { getBreachImpact } from '../api/breachApi';
import { elementTitle } from '../breachRules';
import { FlameIcon } from './FlameIcon';

function ImpactList({ title, impacts, isEntering }: { title: string; impacts: BreachImpactDto[]; isEntering: boolean }) {
  if (impacts.length === 0) return null;
  return (
    <div className="breach-impact-group">
      <h3 className="breach-impact-title">{title}</h3>
      <ul className="breach-result-list">
        {impacts.map((impact) => (
          <li key={`${impact.ruleId}:${impact.element.id}`} className="breach-impact-row">
            <span className={`breach-result-mark${isEntering ? ' is-breach' : ''}`} aria-hidden="true">
              <FlameIcon size={14} />
            </span>
            <span className="breach-result-name">{elementTitle(impact.element)}</span>
            <span className="data-model-chip">{impact.ruleName}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** What accepting this pending Change would do to the breaches. */
export function BreachImpactSection({ runId, itemId }: { runId: string; itemId: string }) {
  const [impact, setImpact] = useState<BreachImpactResponseDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setImpact(null);
    setError(null);
    getBreachImpact(runId, itemId)
      .then((loaded) => {
        if (!cancelled) setImpact(loaded);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to load the breach impact.');
      });
    return () => {
      cancelled = true;
    };
  }, [runId, itemId]);

  const isEmpty = impact !== null && impact.entering.length === 0 && impact.leaving.length === 0;

  return (
    <section className="breach-impact" aria-label="Breach impact">
      <h2 className="breach-impact-heading">
        <FlameIcon size={16} />
        Breach impact
      </h2>
      {error ? <p className="change-detail-error">{error}</p> : null}
      {!error && impact === null ? <p className="change-detail-hint">Evaluating the breach rules…</p> : null}
      {isEmpty ? <p className="change-detail-hint">No breach impact.</p> : null}
      {impact ? (
        <>
          <ImpactList title="Would enter breach" impacts={impact.entering} isEntering />
          <ImpactList title="Would leave breach" impacts={impact.leaving} isEntering={false} />
        </>
      ) : null}
    </section>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BreachElementDto, BreachResultDto } from '@/types/api';
import type { MapLocationState } from '@/features/map/utils/mapNavigation';
import { elementTitle, scopeLabel } from '../breachRules';
import { FlameIcon } from './FlameIcon';

type ResultTab = 'breaches' | 'unknown';

/** Opens Cartography on the element: the application, or both ends of the flow. */
function mapStateFor(element: BreachElementDto): MapLocationState {
  const applicationIds =
    element.kind === 'FLOW' ? [element.sourceId, element.targetId].filter((id): id is string => Boolean(id)) : [element.id];
  return { graphMode: 'normal', applySnapshot: { applicationIds, nodeAttributes: {}, nodeRefs: {} } };
}

function ElementRow({ element, isBreach }: { element: BreachElementDto; isBreach: boolean }) {
  const navigate = useNavigate();
  return (
    <li>
      <button type="button" className="breach-result-row" onClick={() => navigate('/map', { state: mapStateFor(element) })}>
        <span className={`breach-result-mark${isBreach ? ' is-breach' : ''}`} aria-hidden="true">
          {isBreach ? <FlameIcon size={14} /> : '?'}
        </span>
        <span className="breach-result-name">{elementTitle(element)}</span>
        <span className="breach-result-values">
          {element.values.map((tested) => (
            <span key={`${tested.scope}:${tested.attribute}`} className="data-model-chip">
              {scopeLabel(tested.scope)} · {tested.attribute}: {tested.values.length > 0 ? tested.values.join(', ') : '—'}
            </span>
          ))}
        </span>
      </button>
    </li>
  );
}

export function BreachResults({ result, isLoading }: { result: BreachResultDto | null; isLoading: boolean }) {
  const [tab, setTab] = useState<ResultTab>('breaches');
  const breaches = result?.breaches ?? [];
  const unknown = result?.unknown ?? [];
  const elements = tab === 'breaches' ? breaches : unknown;

  return (
    <section className="breach-results" aria-label="Rule results">
      <div className="graph-display-toggle breach-results-tabs" role="tablist" aria-label="Results">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'breaches'}
          className={`graph-display-toggle-btn${tab === 'breaches' ? ' is-active' : ''}`}
          onClick={() => setTab('breaches')}
        >
          <span className="graph-display-toggle-label">In breach ({breaches.length})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'unknown'}
          className={`graph-display-toggle-btn${tab === 'unknown' ? ' is-active' : ''}`}
          onClick={() => setTab('unknown')}
        >
          <span className="graph-display-toggle-label">Not evaluable ({unknown.length})</span>
        </button>
      </div>
      {tab === 'unknown' ? (
        <p className="data-model-field-note">A value is missing or is not a number, so the rule cannot decide.</p>
      ) : null}
      {isLoading ? <p className="data-model-empty">Evaluating…</p> : null}
      {!isLoading && result && elements.length === 0 ? (
        <p className="data-model-empty">{tab === 'breaches' ? 'Nothing is in breach of this rule.' : 'Every element could be evaluated.'}</p>
      ) : null}
      {!isLoading && !result ? <p className="data-model-empty">Save the rule to see what it flags.</p> : null}
      {!isLoading && elements.length > 0 ? (
        <ul className="breach-result-list">
          {elements.map((element) => (
            <ElementRow key={element.id} element={element} isBreach={tab === 'breaches'} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

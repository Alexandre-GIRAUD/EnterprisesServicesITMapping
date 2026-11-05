import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BreachElementDto, BreachResultDto } from '@/types/api';
import type { MapLocationState } from '@/features/map/utils/mapNavigation';
import { elementTitle, scopeLabel } from '../breachRules';
import { FlameIcon } from './FlameIcon';

const MAP_PATH = '/map';
const NO_VALUE = '—';

type ResultTab = 'breaches' | 'unknown';

const TABS: { tab: ResultTab; label: string; empty: string }[] = [
  { tab: 'breaches', label: 'In breach', empty: 'Nothing is in breach of this rule.' },
  { tab: 'unknown', label: 'Not evaluable', empty: 'Every element could be evaluated.' },
];

/** Opens Cartography on the application, or on both applications of the flow. */
function buildMapState(element: BreachElementDto): MapLocationState {
  const applicationIds = element.source && element.target ? [element.source.id, element.target.id] : [element.id];
  return { graphMode: 'normal', applySnapshot: { applicationIds, nodeAttributes: {}, nodeRefs: {} } };
}

function ElementRow({ element, isBreach }: { element: BreachElementDto; isBreach: boolean }) {
  const navigate = useNavigate();
  return (
    <li>
      <button
        type="button"
        className="breach-result-row"
        onClick={() => navigate(MAP_PATH, { state: buildMapState(element) })}
      >
        <span className={`breach-result-mark${isBreach ? ' is-breach' : ''}`} aria-hidden="true">
          {isBreach ? <FlameIcon size="inline" /> : '?'}
        </span>
        <span className="breach-result-name">{elementTitle(element)}</span>
        <span className="breach-result-values">
          {element.values.map((tested) => (
            <span key={`${tested.scope}:${tested.attribute}`} className="data-model-chip">
              {scopeLabel(tested.scope)} · {tested.attribute}: {tested.values.join(', ') || NO_VALUE}
            </span>
          ))}
        </span>
      </button>
    </li>
  );
}

function ResultList({ elements, tab }: { elements: BreachElementDto[]; tab: ResultTab }) {
  if (elements.length === 0) {
    return <p className="data-model-empty">{TABS.find((entry) => entry.tab === tab)?.empty}</p>;
  }
  return (
    <ul className="breach-result-list">
      {elements.map((element) => (
        <ElementRow key={element.id} element={element} isBreach={tab === 'breaches'} />
      ))}
    </ul>
  );
}

export function BreachResults({ result, isLoading }: { result: BreachResultDto | null; isLoading: boolean }) {
  const [tab, setTab] = useState<ResultTab>('breaches');
  const isShowingUnknown = tab === 'unknown';

  return (
    <section className="breach-results" aria-label="Rule results">
      <div className="graph-display-toggle breach-results-tabs" role="tablist" aria-label="Results">
        {TABS.map((entry) => (
          <button
            key={entry.tab}
            type="button"
            role="tab"
            aria-selected={tab === entry.tab}
            className={`graph-display-toggle-btn${tab === entry.tab ? ' is-active' : ''}`}
            onClick={() => setTab(entry.tab)}
          >
            <span className="graph-display-toggle-label">
              {entry.label} ({result ? result[entry.tab].length : 0})
            </span>
          </button>
        ))}
      </div>
      {isShowingUnknown ? (
        <p className="data-model-field-note">A value is missing or is not a number, so the rule cannot decide.</p>
      ) : null}
      {isLoading ? <p className="data-model-empty">Evaluating…</p> : null}
      {!isLoading && result ? <ResultList elements={result[tab]} tab={tab} /> : null}
      {!isLoading && !result ? <p className="data-model-empty">Save the rule to see what it flags.</p> : null}
    </section>
  );
}

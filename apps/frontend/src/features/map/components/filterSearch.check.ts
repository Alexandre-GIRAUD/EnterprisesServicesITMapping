/**
 * Runnable self-check for live filter search and flow endpoints.
 * Run: npx --yes tsx src/features/map/components/filterSearch.check.ts
 */
import assert from 'node:assert/strict';
import type { GraphNodeFilterDto } from '@/types/api';
import { appsForCheckedFlows, dimensionMode, selectionBlanksGraph } from './filterDimensionUtils.ts';
import { EMPTY_FILTER_VALUE, searchFilterHits } from './filterSearch.ts';

const description: GraphNodeFilterDto = {
  key: 'description',
  label: 'Description',
  values: ['Billing', EMPTY_FILTER_VALUE],
  fromAllowedValues: false,
  kind: 'NODE',
};
const frequency: GraphNodeFilterDto = {
  key: 'frequency',
  label: 'Frequency',
  values: ['daily'],
  fromAllowedValues: false,
  kind: 'EDGE',
};

const hits = searchFilterHits({
  query: 'app',
  dimensions: [description, frequency],
  applications: [{ id: 'a18', name: 'App 18' }],
  edges: [{ id: 'e1', label: 'App 18 → App 7' }],
  valueLabel: (_dimension, value) => value,
});

assert.deepEqual(
  hits.map((hit) => `${hit.label}:${hit.kind}`),
  ['Application:filter', 'App 18:app', 'App 18 → App 7:edge'],
);

const descriptionHits = searchFilterHits({
  query: 'bill',
  dimensions: [description],
  applications: [],
  edges: [],
  valueLabel: (_dimension, value) => (value === EMPTY_FILTER_VALUE ? 'empty' : value),
});
assert.equal(descriptionHits[0]?.kind, 'attribute');
assert.equal(descriptionHits[0]?.value, 'Billing');

assert.equal(dimensionMode([], ['a', 'b']), 'none');
assert.equal(dimensionMode(['a', 'b'], ['a', 'b']), 'all');
assert.equal(selectionBlanksGraph(['all', 'none']), true);
assert.equal(selectionBlanksGraph(['all', 'some']), false);

assert.deepEqual(appsForCheckedFlows(['a', 'b', 'c'], ['a', 'b', 'c'], ['b', 'c']), ['b', 'c']);
assert.deepEqual(appsForCheckedFlows(['a'], ['a', 'b', 'c'], ['b']), ['a', 'b']);

console.log('filterSearch.check: ok');

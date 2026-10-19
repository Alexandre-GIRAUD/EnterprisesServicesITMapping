/**
 * Runnable self-check for live filter search and flow endpoints.
 * Run: npx --yes tsx src/features/map/components/filterSearch.check.ts
 */
import assert from 'node:assert/strict';
import type { GraphNodeFilterDto } from '@/types/api';
import {
  dimensionMode,
  isGraphBlankedBySelection,
  keepApplicationsForCheckedFlows,
} from './filterDimensionUtils.ts';
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
  ['Application:filter', 'App 18:application', 'App 18 → App 7:edge'],
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
assert.equal(isGraphBlankedBySelection(['all', 'none']), true);
assert.equal(isGraphBlankedBySelection(['all', 'some']), false);

assert.deepEqual(keepApplicationsForCheckedFlows(['a', 'b', 'c'], ['a', 'b', 'c'], ['b', 'c']), ['a', 'b', 'c']);
assert.deepEqual(keepApplicationsForCheckedFlows(['a'], ['a', 'b', 'c'], ['b']), ['a', 'b']);

const manyApplications = Array.from({ length: 13 }, (_item, index) => ({
  id: `n${index}`,
  name: `North ${index}`,
}));
const northHits = searchFilterHits({
  query: 'north',
  dimensions: [
    {
      key: 'region',
      label: 'Region',
      values: ['North plant'],
      fromAllowedValues: false,
      kind: 'NODE',
    },
  ],
  applications: manyApplications,
  edges: [{ id: 'e-north', label: 'North flow' }],
  valueLabel: (_dimension, value) => value,
});
assert.ok(northHits.some((hit) => hit.kind === 'application'));
assert.ok(northHits.some((hit) => hit.kind === 'attribute'));
assert.ok(northHits.some((hit) => hit.kind === 'edge'));

console.log('filterSearch.check: ok');

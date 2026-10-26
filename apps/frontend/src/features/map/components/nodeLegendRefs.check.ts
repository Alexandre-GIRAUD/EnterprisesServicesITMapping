/**
 * App legend treats catalogue references like application attributes.
 * Run: npx --yes tsx src/features/map/components/nodeLegendRefs.check.ts
 */
import assert from 'node:assert/strict';
import type { GraphNodeDto } from '@/types/api';
import {
  collectNodeLegendValues,
  nodeFillColor,
  nodePropertyOptions,
  nodePropValue,
} from './edgeColorProperty.ts';

function app(partial: Pick<GraphNodeDto, 'properties' | 'nodeRefs'>): GraphNodeDto {
  return { id: 'a', label: 'App', type: 'Application', ...partial };
}

const nodes = [
  app({ properties: { tier: 'Gold' }, nodeRefs: { business_function: ['Payments'] } }),
  app({
    properties: {},
    nodeRefs: { business_function: ['Risk', 'Payments'], empty_ref: ['  '] },
  }),
];

const optionKeys = nodePropertyOptions(nodes).map((option) => option.key);
assert.ok(optionKeys.includes('tier'));
assert.ok(optionKeys.includes('business_function'));
assert.equal(optionKeys.includes('empty_ref'), false);
assert.ok(optionKeys.includes('__type__'));

assert.equal(nodePropValue(nodes[0], 'business_function'), 'Payments');
assert.equal(nodePropValue(nodes[1], 'business_function'), null);
assert.deepEqual(collectNodeLegendValues(nodes, 'business_function'), ['Payments', 'Risk']);

assert.equal(
  nodeFillColor(nodes[0], 'business_function', { Payments: '#112233' }),
  '#112233'
);
assert.equal(nodeFillColor(nodes[1], 'business_function', { Payments: '#112233' }), '#ffffff');

console.log('nodeLegendRefs.check: ok');

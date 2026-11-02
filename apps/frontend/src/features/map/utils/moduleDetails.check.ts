/**
 * Runnable self-check: functional module fields and application business model read from the
 * module graph, explicit module links grouped for colors, and external inputs / outputs derived.
 * Run: npx --yes tsx src/features/map/utils/moduleDetails.check.ts
 */
import assert from 'node:assert/strict';
import {
  applicationModelFromNode,
  changedModuleFields,
  externalData,
  filledDetailKeys,
  moduleDetailsFromNode,
  moduleLinkGroups,
  moduleLinksFromEdges,
  parseDataList,
  type ModuleDetails,
} from './moduleDetails.ts';

assert.deepEqual(parseDataList('Trades, Prices\nTrades;  positions ,'), ['Trades', 'Prices', 'positions']);
assert.deepEqual(parseDataList('  '), []);

const node = moduleDetailsFromNode({
  id: 'm1',
  label: 'Ingest',
  type: 'Module',
  description: 'Captures trades',
  properties: {
    owner: 'Front office',
    actors: ['Traders', 'Sales'],
    trigger: 'On each deal',
    dataIn: ['Order'],
    dataOut: 'Trade',
  },
});
assert.deepEqual(node, {
  id: 'm1',
  name: 'Ingest',
  description: 'Captures trades',
  owner: 'Front office',
  actors: ['Traders', 'Sales'],
  trigger: 'On each deal',
  dataIn: ['Order'],
  dataOut: ['Trade'],
});

const bare = moduleDetailsFromNode({ id: 'm2', label: 'Bare', type: 'Module' });
assert.deepEqual(
  [bare.description, bare.owner, bare.actors, bare.trigger, bare.dataIn, bare.dataOut],
  ['', '', [], '', [], []],
);

assert.deepEqual(
  applicationModelFromNode({
    id: 'app',
    label: 'booking',
    type: 'Application',
    properties: { businessObjects: ['Trade', 'Position'], mainJourney: 'Capture then value', scope: 'Equities only' },
  }),
  { businessObjects: ['Trade', 'Position'], mainJourney: 'Capture then value', scope: 'Equities only' },
);
assert.deepEqual(applicationModelFromNode({ id: 'app', label: 'x', type: 'Application' }), {
  businessObjects: [],
  mainJourney: '',
  scope: '',
});

// Only FEEDS edges are module links; CONTAINS edges build the hierarchy.
const links = moduleLinksFromEdges([
  { id: 'e1', sourceId: 'app', targetId: 'a', type: 'CONTAINS' },
  { id: 'e2', sourceId: 'a', targetId: 'b', type: 'FEEDS', data: 'Trade' },
  { id: 'e3', sourceId: 'b', targetId: 'c', type: 'FEEDS' },
]);
assert.deepEqual(links, [
  { sourceId: 'a', targetId: 'b', object: 'Trade' },
  { sourceId: 'b', targetId: 'c', object: '' },
]);

// a -> b -> c form one group, e -> f a second one; d is alone.
const groups = moduleLinkGroups([
  ...links,
  { sourceId: 'e', targetId: 'f', object: 'Cash' },
]);
assert.equal(groups.get('a'), 0);
assert.equal(groups.get('b'), 0);
assert.equal(groups.get('c'), 0);
assert.equal(groups.has('d'), false);
assert.equal(groups.get('e'), 1);
assert.equal(groups.get('f'), 1);

const make = (id: string, dataIn: string[], dataOut: string[]): ModuleDetails => ({
  id,
  name: id,
  description: '',
  owner: '',
  actors: [],
  trigger: '',
  dataIn,
  dataOut,
});

// External inputs: consumed by a module and produced by none. External outputs: the reverse.
assert.deepEqual(
  externalData([make('a', ['Order', 'Trade'], ['Trade']), make('b', ['Trade'], ['Report', 'Cash']), make('c', ['cash'], [])]),
  { inputs: ['Order'], outputs: ['Report'] },
);

const before = make('a', ['X'], ['Y']);
assert.deepEqual(changedModuleFields(before, { ...before }), []);
assert.deepEqual(
  changedModuleFields(before, { ...before, description: 'new', actors: ['Ops'], trigger: 'Daily', dataIn: ['X', 'Z'] }),
  ['description', 'actors', 'trigger', 'dataIn'],
);

// A card lists only what is filled in, besides the description.
assert.deepEqual(filledDetailKeys(make('a', [], [])), []);
assert.deepEqual(
  filledDetailKeys({ ...make('a', ['X'], []), owner: 'Front office', trigger: 'Daily' }),
  ['owner', 'trigger', 'dataIn'],
);

console.log('moduleDetails.check: ok');

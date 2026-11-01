/**
 * Runnable self-check: module fields read from the module graph, data lists typed by hand, and
 * modules grouped when one consumes what another produces.
 * Run: npx --yes tsx src/features/map/utils/moduleDetails.check.ts
 */
import assert from 'node:assert/strict';
import {
  changedModuleFields,
  moduleDetailsFromNode,
  moduleLinkGroups,
  parseDataList,
  type ModuleDetails,
} from './moduleDetails.ts';

assert.deepEqual(parseDataList('Trades, Prices\nTrades;  positions ,'), ['Trades', 'Prices', 'positions']);
assert.deepEqual(parseDataList('  '), []);

const node = moduleDetailsFromNode({
  id: 'm1',
  label: 'Ingest',
  type: 'Module',
  description: 'Reads trades',
  properties: { owner: 'Team A', technology: 'Kafka', dataIn: ['Trades'], dataOut: 'Positions' },
});
assert.deepEqual(node, {
  id: 'm1',
  name: 'Ingest',
  description: 'Reads trades',
  owner: 'Team A',
  technology: 'Kafka',
  dataIn: ['Trades'],
  dataOut: ['Positions'],
});

const bare = moduleDetailsFromNode({ id: 'm2', label: 'Bare', type: 'Module' });
assert.deepEqual([bare.description, bare.owner, bare.technology, bare.dataIn, bare.dataOut], ['', '', '', [], []]);

const make = (id: string, dataIn: string[], dataOut: string[]): ModuleDetails => ({
  id,
  name: id,
  description: '',
  owner: '',
  technology: '',
  dataIn,
  dataOut,
});

// a -> b -> c form one group; d is alone; e/f form a second group (case-insensitive match)
const groups = moduleLinkGroups([
  make('a', [], ['Trades']),
  make('b', ['trades'], ['Positions']),
  make('c', ['Positions'], []),
  make('d', ['Unrelated'], []),
  make('e', [], ['Cash']),
  make('f', ['CASH'], []),
]);
assert.equal(groups.get('a'), 0);
assert.equal(groups.get('b'), 0);
assert.equal(groups.get('c'), 0);
assert.equal(groups.has('d'), false);
assert.equal(groups.get('e'), 1);
assert.equal(groups.get('f'), 1);

const before = make('a', ['X'], ['Y']);
assert.deepEqual(changedModuleFields(before, { ...before }), []);
assert.deepEqual(
  changedModuleFields(before, { ...before, description: 'new', dataIn: ['X', 'Z'] }),
  ['description', 'dataIn'],
);

console.log('moduleDetails.check: ok');

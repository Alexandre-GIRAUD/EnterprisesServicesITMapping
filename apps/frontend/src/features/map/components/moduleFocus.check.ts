/**
 * Module hover tiers: the module and what it contains, then the modules it exchanges data with.
 * Run: npx --yes tsx src/features/map/components/moduleFocus.check.ts
 */
import assert from 'node:assert/strict';
import { computeModuleTiers } from './moduleFocus.ts';

const childrenByParent = new Map([
  ['app', ['m1', 'm2', 'box']],
  ['box', ['m3', 'm4']],
]);
const nodeIds = ['app', 'm1', 'm2', 'box', 'm3', 'm4'];
const links = [
  { sourceId: 'm1', targetId: 'm2', object: 'Order' },
  { sourceId: 'm2', targetId: 'm3', object: 'Invoice' },
];

const leaf = computeModuleTiers({ focusId: 'm2', nodeIds, childrenByParent, links });
assert.equal(leaf.get('m2'), 'self');
assert.equal(leaf.get('m1'), 'neighbor');
assert.equal(leaf.get('m3'), 'neighbor');
assert.equal(leaf.get('m4'), 'faded');
assert.equal(leaf.get('app'), 'context');

const container = computeModuleTiers({ focusId: 'box', nodeIds, childrenByParent, links });
assert.equal(container.get('box'), 'self');
assert.equal(container.get('m3'), 'self');
assert.equal(container.get('m4'), 'self');
assert.equal(container.get('m2'), 'neighbor');
assert.equal(container.get('m1'), 'faded');
assert.equal(container.get('app'), 'context');

const everything = computeModuleTiers({ focusId: 'app', nodeIds, childrenByParent, links });
assert.ok(nodeIds.every((id) => everything.get(id) === 'self'));

console.log('moduleFocus.check: ok');

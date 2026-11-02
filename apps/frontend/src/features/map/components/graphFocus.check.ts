/**
 * Hover tiers: the focused node stands out more than its neighbors, which stand out more than the rest.
 * Run: npx --yes tsx src/features/map/components/graphFocus.check.ts
 */
import assert from 'node:assert/strict';
import type { Edge } from '@xyflow/react';
import { computeFocus, focusTier, tierClassName } from './graphFocus.ts';

const edges = [
  { id: 'e1', source: 'a', target: 'b' },
  { id: 'e2', source: 'c', target: 'a' },
  { id: 'e3', source: 'd', target: 'e' },
] as Edge[];

const focus = computeFocus(edges, 'a');
assert.equal(focusTier(focus, 'a', 'a'), 'self');
assert.equal(focusTier(focus, 'a', 'b'), 'neighbor');
assert.equal(focusTier(focus, 'a', 'c'), 'neighbor');
assert.equal(focusTier(focus, 'a', 'd'), 'faded');
assert.equal(focusTier(null, null, 'a'), null);

assert.equal(tierClassName('self'), 'is-focus is-focus-self');
assert.equal(tierClassName('neighbor'), 'is-focus');
assert.equal(tierClassName('faded'), 'is-faded');
assert.equal(tierClassName(null), undefined);

console.log('graphFocus.check: ok');

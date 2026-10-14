/**
 * Runnable self-check for multi-value Data Model attributes.
 * Run: npx --yes tsx src/features/map/utils/attributeValue.check.ts
 */
import assert from 'node:assert/strict';
import {
  dedupeAttributeValues,
  sameAttributeValues,
  storedAttributeList,
  storedAttributeText,
} from './attributeValue.ts';

assert.deepEqual(storedAttributeList(' EU '), ['EU']);
assert.deepEqual(storedAttributeList([' US ', 'EU', '']), ['US', 'EU']);
assert.equal(storedAttributeText(['EU', 'US']), 'EU, US');
assert.equal(storedAttributeText('EU'), 'EU');
assert.deepEqual(dedupeAttributeValues(['EU', 'eu', 'US']), ['EU', 'US']);
assert.equal(sameAttributeValues('EU', ['eu']), true);
assert.equal(sameAttributeValues(['EU', 'US'], ['EU']), false);

console.log('attributeValue.check: ok');

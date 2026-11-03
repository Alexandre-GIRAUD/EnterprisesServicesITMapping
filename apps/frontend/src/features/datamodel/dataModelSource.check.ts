/**
 * Runnable self-check for the Data Model attribute source choice.
 * Run: npx --yes tsx src/features/datamodel/dataModelSource.check.ts
 */
import assert from 'node:assert/strict';
import { fieldSourceChoice, sourceChoicePatch, sourceChoiceOptions } from './dataModelSource.ts';

assert.equal(fieldSourceChoice({ detection: 'AUTOMATIC_DETECTION' }), 'code');
assert.equal(fieldSourceChoice({}), 'code');
assert.equal(fieldSourceChoice({ detection: 'MANUAL' }), 'manual');
assert.equal(fieldSourceChoice({ detection: 'MANUAL', sourceId: 's1' }), 's1');

assert.deepEqual(sourceChoicePatch('code'), { detection: 'AUTOMATIC_DETECTION', sourceId: undefined });
assert.deepEqual(sourceChoicePatch('manual'), { detection: 'MANUAL', sourceId: undefined });
assert.deepEqual(sourceChoicePatch('s1'), { detection: 'MANUAL', sourceId: 's1' });

assert.deepEqual(sourceChoiceOptions([{ id: 's1', name: 'Referential' }], true), [
  { value: 'code', label: 'Code' },
  { value: 'manual', label: 'Manual' },
  { value: 's1', label: 'Referential' },
]);
assert.deepEqual(sourceChoiceOptions([{ id: 's1', name: 'Referential' }], false), [
  { value: 'code', label: 'Code' },
  { value: 'manual', label: 'Manual' },
]);
console.log('dataModelSource.check ok');

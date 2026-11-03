/**
 * Runnable self-check for the source mapping draft.
 * Run: npx --yes tsx src/features/sources/mappingDraft.check.ts
 */
import assert from 'node:assert/strict';
import { mappingRows, toMappingPayload } from './mappingDraft.ts';

const apps = [
  { id: 'a1', name: 'app1' },
  { id: 'a2', name: 'billing' },
];
const rows = mappingRows(apps, [{ applicationId: 'a2', sourceKey: 'BILL', noMatch: false }], { a1: 'app__1' });
assert.deepEqual(rows, [
  { applicationId: 'a1', name: 'app1', sourceKey: 'app__1', noMatch: false, suggested: true },
  { applicationId: 'a2', name: 'billing', sourceKey: 'BILL', noMatch: false, suggested: false },
]);

assert.deepEqual(
  toMappingPayload([
    { ...rows[0], noMatch: true },
    { ...rows[1], sourceKey: '  ' },
  ]),
  [{ applicationId: 'a1', sourceKey: null, noMatch: true }],
);
console.log('mappingDraft.check ok');

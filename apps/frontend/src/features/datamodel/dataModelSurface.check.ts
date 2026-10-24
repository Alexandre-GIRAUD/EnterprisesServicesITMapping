/**
 * Runnable self-check for the Data Model App / Flows split.
 * Run: npx --yes tsx src/features/datamodel/dataModelSurface.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { DataModelFieldDto } from '@/types/api';
import { fieldsForSurface } from './dataModelSurface.ts';

function field(target: 'EDGE' | 'NODE' | 'NODE_REF'): DataModelFieldDto {
  return {
    key: target.toLowerCase(),
    label: target,
    target,
    detection: 'MANUAL',
    allowedValues: [],
    enforceEnum: false,
    required: false,
    multiple: false,
  };
}

const fields = [field('EDGE'), field('NODE'), field('NODE_REF')];

assert.deepEqual(
  fieldsForSurface(fields, 'app').map((item) => item.target),
  ['NODE', 'NODE_REF']
);
assert.deepEqual(
  fieldsForSurface(fields, 'flows').map((item) => item.target),
  ['EDGE']
);

const page = readFileSync(new URL('./pages/DataModelPage.tsx', import.meta.url), 'utf8');
assert.match(page, />App</);
assert.match(page, />Flows</);
assert.doesNotMatch(page, /Define dynamic fields for connection flows/);
assert.doesNotMatch(page, /Edge fields never appear there/);
assert.doesNotMatch(page, /No automatic-detection fields/);

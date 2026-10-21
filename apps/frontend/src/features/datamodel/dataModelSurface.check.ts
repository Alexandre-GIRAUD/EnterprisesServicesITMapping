/**
 * Runnable self-check for the Data Model Application / Flows split.
 * Run: npx --yes tsx src/features/datamodel/dataModelSurface.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isFlowField } from './dataModelSurface.ts';

assert.equal(isFlowField({ key: 'a', label: 'A', target: 'EDGE', enforceEnum: false, required: false }), true);
assert.equal(isFlowField({ key: 'a', label: 'A', enforceEnum: false, required: false }), true);
assert.equal(isFlowField({ key: 'a', label: 'A', target: 'NODE_REF', enforceEnum: false, required: false }), false);

const page = readFileSync(new URL('./pages/DataModelPage.tsx', import.meta.url), 'utf8');
assert.match(page, /'Application'/);
assert.match(page, /'Flows'/);
assert.match(page, /Add attribute/);
assert.match(page, /Prompt preview/);
assert.doesNotMatch(page, /Define dynamic fields for connection flows/);
assert.doesNotMatch(page, /Edge fields never appear there/);
assert.doesNotMatch(page, /No automatic-detection fields/);

console.log('dataModelSurface checks passed');

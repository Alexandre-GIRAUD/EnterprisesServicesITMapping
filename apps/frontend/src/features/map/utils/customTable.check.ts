/**
 * Runnable self-check for the custom table axis catalogue.
 * Run: npx --yes tsx src/features/map/utils/customTable.check.ts
 */
import assert from 'node:assert/strict';
import { buildAxisOptions } from './customTable.ts';

const options = buildAxisOptions([
  { key: 'domain', label: 'Domain', kind: 'NODE' },
  { key: 'region', label: 'Region', kind: 'NODE_REF' },
  { key: 'frequency', label: 'Frequency', kind: 'EDGE' },
  { key: 'payload', label: 'Payload', kind: 'EDGE' },
  { key: 'tier', kind: 'NODE' },
]);

assert.deepEqual(options, [
  { id: 'application', key: 'application', kind: 'APPLICATION', direction: null, label: 'Application' },
  { id: 'node:domain', key: 'domain', kind: 'NODE', direction: null, label: 'Domain' },
  { id: 'noderef:region', key: 'region', kind: 'NODE_REF', direction: null, label: 'Region' },
  { id: 'edge:frequency:incoming', key: 'frequency', kind: 'EDGE', direction: 'incoming', label: 'Frequency — incoming' },
  { id: 'edge:frequency:outgoing', key: 'frequency', kind: 'EDGE', direction: 'outgoing', label: 'Frequency — outgoing' },
  { id: 'edge:frequency:any', key: 'frequency', kind: 'EDGE', direction: 'any', label: 'Frequency — any' },
  { id: 'edge:payload:incoming', key: 'payload', kind: 'EDGE', direction: 'incoming', label: 'Payload — incoming' },
  { id: 'edge:payload:outgoing', key: 'payload', kind: 'EDGE', direction: 'outgoing', label: 'Payload — outgoing' },
  { id: 'edge:payload:any', key: 'payload', kind: 'EDGE', direction: 'any', label: 'Payload — any' },
  { id: 'node:tier', key: 'tier', kind: 'NODE', direction: null, label: 'tier' },
]);

const withLaterField = buildAxisOptions([
  { key: 'domain', label: 'Domain' },
  { key: 'cost_center', label: 'Cost center', kind: 'NODE' },
]);

assert.deepEqual(
  withLaterField.map((option) => option.id),
  ['application', 'node:domain', 'node:cost_center'],
);
assert.equal(withLaterField[1]?.label, 'Domain');
assert.equal(withLaterField[2]?.label, 'Cost center');

console.log('customTable.check: ok');

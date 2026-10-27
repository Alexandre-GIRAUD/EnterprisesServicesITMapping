/**
 * Runnable self-check for change source and destination labels.
 * Run: npx --yes tsx src/features/map/utils/changeDetectionUi.check.ts
 */
import assert from 'node:assert/strict';
import type { ChangeDetectionItemDto, ChangeDetectionRunDto } from '../../../types/api.ts';
import { edgeAttributeRows, flattenPendingChips, resolveAppName, resolveSourceDest } from './changeDetectionUi.ts';

const names = new Map<string, string>([
  ['app-datahub', 'DataHub'],
  ['app-analytics', 'Analytics'],
  ['app-booking', 'Booking'],
]);

function item(payload: Record<string, unknown>): ChangeDetectionItemDto {
  return {
    id: 'item-1',
    kind: 'CONNECTION',
    status: 'PENDING',
    confidence: 0.65,
    summary: 'connection',
    evidence: [],
    payload,
    createdAt: '2026-10-26T21:00:00Z',
    updatedAt: '2026-10-26T21:00:00Z',
  };
}

function run(payload: Record<string, unknown>): ChangeDetectionRunDto {
  return {
    id: 'run-1',
    provider: 'GITHUB',
    repoFullName: 'acme/datahub',
    commitSha: 'abcdef1234567890',
    branchRef: 'refs/heads/main',
    applicationId: 'app-datahub',
    status: 'READY',
    truncated: false,
    buckets: [],
    files: [],
    items: [item(payload)],
    createdAt: '2026-10-26T21:00:00Z',
    updatedAt: '2026-10-26T21:00:00Z',
  };
}

const outbound = run({
  action: 'APPLY_CONNECTION',
  direction: 'outbound',
  peerApplicationName: 'analytics',
});
const outboundEnds = resolveSourceDest(outbound, outbound.items[0]!, names);
assert.equal(outboundEnds.source, 'DataHub');
assert.equal(outboundEnds.dest, 'Analytics');
assert.equal(outboundEnds.destMissing, false);
assert.equal(flattenPendingChips([outbound], names)[0]?.nodesLabel, 'DataHub → Analytics');

const inbound = run({
  action: 'APPLY_CONNECTION',
  direction: 'inbound',
  peerApplicationName: 'booking',
});
const inboundEnds = resolveSourceDest(inbound, inbound.items[0]!, names);
assert.equal(inboundEnds.source, 'Booking');
assert.equal(inboundEnds.dest, 'DataHub');
assert.equal(flattenPendingChips([inbound], names)[0]?.nodesLabel, 'Booking → DataHub');

assert.equal(
  resolveAppName('e6a7b2e6-def7-426a-bda6-9f5bf5f4a7fe', names),
  'Unknown application'
);

const withAttributes = run({
  action: 'APPLY_CONNECTION',
  direction: 'outbound',
  peerApplicationName: 'analytics',
  edgeAttributes: { frequency: 'Daily', data_domain: 'Prices' },
});
const rows = edgeAttributeRows(
  withAttributes.items[0]!.payload,
  new Map([['frequency', 'How often']])
);
assert.deepEqual(
  rows.map((row) => `${row.label}=${row.value}`),
  ['How often=Daily', 'Data domain=Prices']
);
assert.equal(edgeAttributeRows({ edgeAttributes: {} }).length, 0);

console.log('changeDetectionUi.check: ok');

/**
 * History names what was created or deleted: an application, a module or a flow.
 * Run: npx --yes tsx src/features/map/utils/historyEventSummary.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { AttributeChangeEventDto } from '../../../types/api.ts';
import { historyRangeQuery, linkEventSummary } from './historyEventSummary.ts';

function linkEvent(
  fieldScope: AttributeChangeEventDto['fieldScope'],
  oldValue: string | null,
  newValue: string | null,
): AttributeChangeEventDto {
  return {
    id: 'event-1',
    targetType: 'APPLICATION',
    targetId: 'app-1',
    fieldScope,
    fieldKey: '__link__',
    oldValue,
    newValue,
    actorType: 'HUMAN',
    actorUserId: null,
    actorUsername: 'alice',
    aiSource: null,
    humanReason: null,
    humanReasonComment: null,
    createdAt: '2026-03-01T10:00:00Z',
  };
}

assert.deepEqual(linkEventSummary(linkEvent('APP_LINK', null, '{"name":"Billing"}')), {
  title: 'Application created',
  detail: 'Billing',
});
assert.deepEqual(linkEventSummary(linkEvent('MODULE_LINK', '{"name":"Invoices"}', null)), {
  title: 'Module deleted',
  detail: 'Invoices',
});
assert.deepEqual(
  linkEventSummary(
    linkEvent('EDGE_LINK', null, '{"type":"DEPENDS_ON","sourceId":"a","targetId":"b"}'),
  ),
  { title: 'Connection created', detail: 'DEPENDS_ON · a → b' },
);

assert.equal(historyRangeQuery('', ''), '');
assert.equal(historyRangeQuery('2026-03-01', ''), '&from=2026-03-01');
assert.equal(historyRangeQuery('2026-03-01', '2026-03-31'), '&from=2026-03-01&to=2026-03-31');

const section = readFileSync(
  new URL('../components/AttributeHistorySection.tsx', import.meta.url),
  'utf8',
);
assert.match(section, /fetchApplicationHistory/);
assert.match(section, /type="date"/);

console.log('historyEventSummary.check: ok');

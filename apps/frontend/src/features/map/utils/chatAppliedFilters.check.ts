/**
 * Runnable self-check for chat-applied map filters.
 * Run: npx --yes tsx src/features/map/utils/chatAppliedFilters.check.ts
 */
import assert from 'node:assert/strict';
import { appliedFiltersFromChat } from './chatAppliedFilters.ts';

assert.equal(appliedFiltersFromChat(null), null);
assert.equal(appliedFiltersFromChat(undefined), null);

assert.deepEqual(appliedFiltersFromChat({} as never), {
  applicationIds: [],
  nodeAttributes: {},
  nodeRefs: {},
  edgeAttributes: {},
});

assert.deepEqual(
  appliedFiltersFromChat({
    applicationIds: ['a1'],
    nodeAttributes: { region: ['Europe'] },
    nodeRefs: {},
  }),
  {
    applicationIds: ['a1'],
    nodeAttributes: { region: ['Europe'] },
    nodeRefs: {},
    edgeAttributes: {},
  }
);

console.log('chatAppliedFilters.check: ok');

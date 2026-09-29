/**
 * Runnable self-check for importing a shared sandbox into the local list.
 * Run: npx --yes tsx src/features/map/utils/sandboxShare.check.ts
 */
import assert from 'node:assert/strict';
import { importSharedSandboxes, type SharedSandboxInboxItem } from './sandboxShare.ts';

type TinyDoc = { id: string; name: string; dirty: boolean; note: string };

const incoming: SharedSandboxInboxItem<TinyDoc> = {
  id: 'share-1',
  name: 'Payments',
  senderUsername: 'alice',
  document: { id: 'sender-doc', name: 'Payments', dirty: true, note: 'kept' },
};

const first = importSharedSandboxes(
  [{ id: 'local', name: 'Payments', updatedAt: '2020-01-01T00:00:00.000Z', document: { id: 'local-doc', name: 'Payments', dirty: false, note: 'mine' } }],
  [incoming],
  () => 'new-id',
  '2026-01-01T00:00:00.000Z',
);

assert.equal(first.saved.length, 2);
assert.equal(first.saved[1]?.name, 'Payments (from alice)');
assert.equal(first.saved[1]?.sourceShareId, 'share-1');
assert.equal(first.saved[1]?.document.id, 'new-id');
assert.equal(first.saved[1]?.document.dirty, false);
assert.equal(first.saved[1]?.document.note, 'kept');
assert.deepEqual(first.acknowledgedIds, ['share-1']);

const again = importSharedSandboxes(first.saved, [incoming], () => 'other', '2026-01-02T00:00:00.000Z');
assert.equal(again.saved.length, 2);
assert.deepEqual(again.acknowledgedIds, ['share-1']);

const free = importSharedSandboxes(
  [],
  [{ ...incoming, id: 'share-2', document: { ...incoming.document } }],
  () => 'free-id',
  '2026-01-01T00:00:00.000Z',
);
assert.equal(free.saved[0]?.name, 'Payments');

console.log('sandboxShare.check: ok');

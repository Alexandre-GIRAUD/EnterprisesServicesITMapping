/**
 * Runnable self-check for custom-table share error text.
 * Run: npx --yes tsx src/features/map/api/customTableSharesApi.check.ts
 */
import assert from 'node:assert/strict';
import { messageForShareFailure } from './shareFailureMessage.ts';

assert.equal(
  messageForShareFailure(400, 'You cannot share with yourself.'),
  'You cannot share with yourself.',
);
assert.equal(messageForShareFailure(404, 'No user with that username.'), 'No user with that username.');
assert.equal(
  messageForShareFailure(400, 'That table is too large to share.'),
  'That table is too large to share.',
);
assert.equal(messageForShareFailure(500, 'nope', 'Table shares'), 'Table shares 500: nope');

console.log('customTableSharesApi.check: ok');

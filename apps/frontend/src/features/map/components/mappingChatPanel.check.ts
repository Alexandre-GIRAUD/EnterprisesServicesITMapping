/**
 * Runnable self-check for the mapping chat empty state.
 * Run: npx --yes tsx src/features/map/components/mappingChatPanel.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chatSuggestionDraft } from './mappingChatSuggestions.ts';

assert.deepEqual(chatSuggestionDraft('Which applications manage payments?'), {
  send: true,
  draft: 'Which applications manage payments?',
});
assert.deepEqual(chatSuggestionDraft('Which applications are connected to…'), {
  send: false,
  draft: 'Which applications are connected to',
});

const source = readFileSync(new URL('./MappingChatPanel.tsx', import.meta.url), 'utf8');
assert.match(source, /Ask anything/);
assert.match(source, /rows=\{2\}/);
assert.match(source, /aria-label="Send"/);
assert.doesNotMatch(source, /Ask Flora/);
assert.doesNotMatch(source, /No conversation yet/);
assert.doesNotMatch(source, />Send</);

console.log('mappingChatPanel.check: ok');

/**
 * The chatbot lives on its own page, not in the Cartography side-menu rail.
 * Run: npx --yes tsx src/features/chat/chatPage.check.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const app = read('../../App.tsx');
assert.match(app, /<Route path="\/chat" element={<ChatPage \/>} \/>/);

const page = read('./ChatPage.tsx');
assert.match(page, /<h1>Chatbot<\/h1>/);
assert.match(page, /flowraLogo/);

assert.equal(existsSync(new URL('../map/components/MappingChatPanel.tsx', import.meta.url)), false);
assert.doesNotMatch(read('../map/components/SelfServiceToolBar.tsx'), /'chat'/);
assert.doesNotMatch(read('../map/components/SelfServiceSideMenu.tsx'), /Ask Flora/);
assert.doesNotMatch(read('../map/components/GraphCanvas.tsx'), /MappingChatPanel|'chat'/);
assert.doesNotMatch(read('../../index.css'), /\.mapping-chat-/);

console.log('chatPage.check: ok');

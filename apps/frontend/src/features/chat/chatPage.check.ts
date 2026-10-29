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
assert.doesNotMatch(page, /Ask about the Production graph/);
assert.equal(page.match(/<ChatComposer\b/g)?.length, 1, 'one composer, pinned at the bottom in every state');
assert.match(page, /openFiltersOnMap\(appliedFilters, withAnswer\)/);
assert.match(page, /sideMenuTool: 'chat'/);
assert.match(page, /chatTurns/);

const css = read('../../index.css');
assert.doesNotMatch(css, /\.chat-page \{[^}]*max-width/, 'the page spans the main area so the composer is centered');
assert.match(css, /\.chat-conversation\.is-empty \{[^}]*justify-content: center/, 'empty chat centers the composer');

assert.equal(existsSync(new URL('../map/components/MappingChatPanel.tsx', import.meta.url)), false);
assert.match(read('../map/components/SelfServiceToolBar.tsx'), /aria-label="Chat"/);
assert.doesNotMatch(read('../map/components/SelfServiceSideMenu.tsx'), /Ask Flora/);
assert.doesNotMatch(read('../map/components/GraphCanvas.tsx'), /MappingChatPanel/);
assert.match(read('../map/components/GraphCanvas.tsx'), /sideMenuTool === 'chat'/);
const burgerChat = read('../map/components/CartographyChatHistory.tsx');
assert.match(burgerChat, /askMappingChat/);
assert.match(burgerChat, /Ask Flowra/);
assert.doesNotMatch(burgerChat, /No conversation yet/);
assert.doesNotMatch(read('../../index.css'), /\.mapping-chat-/);

console.log('chatPage.check: ok');

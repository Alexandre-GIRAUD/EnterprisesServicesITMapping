/**
 * Runnable self-check for the sidebar help menu.
 * Run: npx --yes tsx src/layouts/helpMenu.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HelpMenu } from './HelpMenu.tsx';
import { HELP_TOPICS } from './helpTopics.ts';

const titles = HELP_TOPICS.map((topic) => topic.title);
assert.deepEqual(titles, ['Cartography', 'Data Model', 'Sources', 'Changes', 'Settings']);
const minimumTopicLength = 40;
assert.ok(HELP_TOPICS.every((topic) => topic.text.length > minimumTopicLength));

const html = renderToStaticMarkup(createElement(HelpMenu));
assert.match(html, /aria-label="Help"/);
assert.match(html, /aria-expanded="false"/);
assert.doesNotMatch(html, />Contact</);

const layout = readFileSync(new URL('./Layout.tsx', import.meta.url), 'utf8');
const brandRow = layout.slice(layout.indexOf('layout-brand-row'), layout.indexOf('layout-sidebar-nav'));
assert.match(brandRow, /<h1>Flowra<\/h1>/);
assert.match(brandRow, /<HelpMenu \/>/);
assert.doesNotMatch(brandRow, /ThemeModeButton/);

const helpSource = readFileSync(new URL('./HelpMenu.tsx', import.meta.url), 'utf8');
assert.match(helpSource, /AboutContactForm/);
assert.match(helpSource, /const HELP_PANEL_WIDTH = 352/);
assert.match(helpSource, /width: HELP_PANEL_WIDTH/);

console.log('helpMenu.check: ok');

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
assert.doesNotMatch(brandRow, /<HelpMenu \/>/);

const userCluster = layout.slice(
  layout.indexOf('layout-sidebar-user-meta'),
  layout.indexOf('layout-sidebar-signout'),
);
const helpAt = userCluster.indexOf('<HelpMenu />');
const themeAt = userCluster.indexOf('<ThemeModeButton');
assert.ok(helpAt >= 0 && themeAt > helpAt, 'help sits immediately left of the theme button');

const helpSource = readFileSync(new URL('./HelpMenu.tsx', import.meta.url), 'utf8');
assert.match(helpSource, /AboutContactForm/);
assert.match(helpSource, /const HELP_PANEL_WIDTH = 352/);
assert.match(helpSource, /width: HELP_PANEL_WIDTH/);
assert.match(helpSource, /createPortal\(/);
assert.match(helpSource, /document\.body/);

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const helpToggle = css.match(/\.layout-help-toggle\s*\{[^}]*\}/);
const themeToggle = css.match(/\.layout-theme-toggle\s*\{[^}]*\}/);
assert.ok(helpToggle && themeToggle, 'help and theme button rules missing');
assert.equal(
  helpToggle[0].match(/width:\s*([^;]+)/)?.[1],
  themeToggle[0].match(/width:\s*([^;]+)/)?.[1],
);
assert.equal(
  helpToggle[0].match(/height:\s*([^;]+)/)?.[1],
  themeToggle[0].match(/height:\s*([^;]+)/)?.[1],
);
const helpGlyph = css.match(/\.layout-help-toggle svg\s*\{[^}]*\}/);
const themeGlyph = css.match(/\.layout-theme-toggle svg\s*\{[^}]*\}/);
assert.ok(helpGlyph && themeGlyph, 'help and theme glyph rules missing');
assert.equal(
  helpGlyph[0].match(/width:\s*([^;]+)/)?.[1],
  themeGlyph[0].match(/width:\s*([^;]+)/)?.[1],
);

const panelRule = css.match(/\.layout-help-panel\s*\{[^}]*\}/);
assert.ok(panelRule, 'help panel rule missing');
const panelZIndex = Number(panelRule[0].match(/z-index:\s*(\d+)/)?.[1]);
assert.ok(panelZIndex > 80, 'help panel must paint above the map overlays');

console.log('helpMenu.check: ok');

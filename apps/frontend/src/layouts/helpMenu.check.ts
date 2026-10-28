/**
 * Runnable self-check for the sidebar help menu.
 * Run: npx --yes tsx src/layouts/helpMenu.check.ts
 */
import './cssHook.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HELP_TOPICS } from './helpTopics.ts';

const { HelpMenu } = await import('./HelpMenu.tsx');

const titles = HELP_TOPICS.map((topic) => topic.title);
assert.deepEqual(titles, ['Cartography', 'Data Model', 'Sources', 'Changes', 'Settings']);
const minimumTopicLength = 40;
assert.ok(HELP_TOPICS.every((topic) => topic.text.length > minimumTopicLength));

const cartography = HELP_TOPICS.find((topic) => topic.title === 'Cartography');
assert.ok(cartography);
assert.match(cartography.text, /The map of applications and the flows between them\./);
assert.match(
  cartography.text,
  /pin\.\n\nProduction\. Tip: double-click an application to open its module graph\. Single-click for details\./,
);
assert.match(
  cartography.text,
  /Filters\. Narrow the graph\. Each dimension combines with AND \(all conditions must match\)\./,
);
assert.match(
  cartography.text,
  /My views\. Saved views \(filters, hidden apps, layout\)\. Select a view to apply it to the graph\./,
);
assert.match(cartography.text, /Sandbox\. Sandbox — customize your graph, no changes saved\./);

const html = renderToStaticMarkup(createElement(HelpMenu));
assert.match(html, /aria-label="Help"/);
assert.match(html, />Help</);
assert.doesNotMatch(html, /title="Help"/);
assert.match(html, /aria-expanded="false"/);
assert.doesNotMatch(html, />Contact</);

const layout = readFileSync(new URL('./Layout.tsx', import.meta.url), 'utf8');
const brandRow = layout.slice(layout.indexOf('layout-brand-row'), layout.indexOf('layout-sidebar-nav'));
assert.match(brandRow, /<h1>Flowra<\/h1>/);
assert.doesNotMatch(brandRow, /<HelpMenu \/>/);

const footer = layout.slice(layout.indexOf('sidebar-footer'));
const helpAt = footer.indexOf('<HelpMenu />');
const settingsAt = footer.indexOf('<SettingsMenu />');
const profileAt = footer.indexOf('<SidebarProfile');
const themeAt = footer.indexOf('<ThemeToggle');
assert.ok(helpAt >= 0 && settingsAt > helpAt, 'settings sits with help');
assert.ok(profileAt > settingsAt, 'profile sits under help and settings');
assert.ok(themeAt > profileAt, 'theme stays on the account line');
assert.doesNotMatch(layout, /Sign out/);

const helpSource = readFileSync(new URL('./HelpMenu.tsx', import.meta.url), 'utf8');
assert.match(helpSource, /AboutContactForm/);
assert.match(helpSource, /const HELP_PANEL_WIDTH = 352/);
assert.match(helpSource, /width: HELP_PANEL_WIDTH/);
assert.match(helpSource, /createPortal\(/);
assert.match(helpSource, /document\.body/);

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const sidebarCss = readFileSync(new URL('./sidebar.css', import.meta.url), 'utf8');
assert.match(helpSource, /SidebarNavItem/);
assert.match(helpSource, /circleHelp/);
assert.match(sidebarCss, /height:\s*var\(--nav-item-height\)/);

const helpParagraph = css.match(/\.layout-help-section p\s*\{[^}]*\}/);
assert.ok(helpParagraph, 'help paragraph rule missing');
assert.match(helpParagraph[0], /white-space:\s*pre-line/);

const panelRule = css.match(/\.layout-help-panel\s*\{[^}]*\}/);
assert.ok(panelRule, 'help panel rule missing');
const panelZIndex = Number(panelRule[0].match(/z-index:\s*(\d+)/)?.[1]);
assert.ok(panelZIndex > 80, 'help panel must paint above the map overlays');

console.log('helpMenu.check: ok');

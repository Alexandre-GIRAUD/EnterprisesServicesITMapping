/**
 * Runnable self-check for the side navigation that replaced the top header.
 * Run: npx --yes tsx src/layouts/sidebarNav.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mainNavigationEntries } from './sidebarModel.ts';

const layout = readFileSync(new URL('./Layout.tsx', import.meta.url), 'utf8');
const settingsMenu = readFileSync(new URL('./SettingsMenu.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const sidebarCss = readFileSync(new URL('./sidebar.css', import.meta.url), 'utf8');

assert.match(layout, /<aside[\s\S]*?className="layout-sidebar"/);
assert.doesNotMatch(layout, /<header/);
assert.doesNotMatch(css, /\.layout-header/);

const labels = mainNavigationEntries().map((entry) => entry.label);
assert.deepEqual(labels, ['Chatbot', 'Cartography', 'Data Model', 'Sources', 'Changes']);
assert.equal(mainNavigationEntries().find((entry) => entry.label === 'Chatbot')?.to, '/chat');
assert.match(settingsMenu, /label="Settings"/);
assert.match(layout, /mainNavigationEntries\(/);
assert.doesNotMatch(layout, /Sign out/);

assert.match(css, /\.layout \{[^}]*flex-direction: row/);
const activeLink = sidebarCss.match(/\.sidebar-nav-item\.is-active,\s*\n\.sidebar-subitem\.is-active,[\s\S]*?\{[^}]*\}/);
assert.ok(activeLink, 'active sidebar link rule missing');
assert.match(activeLink[0], /background/);

console.log('sidebarNav.check: ok');

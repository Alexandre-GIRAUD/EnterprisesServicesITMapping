/**
 * Runnable self-check for the side navigation that replaced the top header.
 * Run: npx --yes tsx src/layouts/sidebarNav.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const layout = readFileSync(new URL('./Layout.tsx', import.meta.url), 'utf8');
const settingsMenu = readFileSync(new URL('./SettingsMenu.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

assert.match(layout, /<aside className="layout-sidebar"/);
assert.doesNotMatch(layout, /<header/);
assert.doesNotMatch(css, /\.layout-header/);

const labels = [...layout.matchAll(/label: '([^']+)'/g)].map((match) => match[1]);
assert.deepEqual(labels, ['Cartography', 'Data Model', 'Sources', 'Changes']);
assert.match(settingsMenu, />Settings</);
assert.match(layout, /Sign out/);

assert.match(css, /\.layout \{[^}]*flex-direction: row/);
const activeLink = css.match(/\.layout-sidebar-link\.is-active\s*\{[^}]*\}/);
assert.ok(activeLink, 'active sidebar link rule missing');
assert.match(activeLink[0], /background/);

console.log('sidebarNav.check: ok');

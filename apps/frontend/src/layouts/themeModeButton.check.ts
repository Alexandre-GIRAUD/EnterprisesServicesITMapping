/**
 * Runnable self-check for the sidebar theme icon.
 * Run: npx --yes tsx src/layouts/themeModeButton.check.ts
 */
import './cssHook.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const { ThemeToggle } = await import('./ThemeToggle.tsx');

const dark = renderToStaticMarkup(
  createElement(ThemeToggle, { theme: 'dark', onToggle: () => undefined }),
);
assert.match(dark, /class="sidebar-theme-toggle"/);
assert.match(dark, /aria-label="Changer de thème"/);
assert.match(dark, /aria-pressed="true"/);
assert.match(dark, /<path /);
assert.doesNotMatch(dark, /<circle /);

const light = renderToStaticMarkup(
  createElement(ThemeToggle, { theme: 'light', onToggle: () => undefined }),
);
assert.match(light, /aria-label="Changer de thème"/);
assert.match(light, /aria-pressed="false"/);
assert.match(light, /<circle /);

const layout = readFileSync(new URL('./Layout.tsx', import.meta.url), 'utf8');
const account = layout.slice(layout.indexOf('sidebar-account'), layout.indexOf('layout-main'));
assert.match(account, /ThemeToggle/);
assert.match(account, /SidebarProfile/);
assert.doesNotMatch(layout, />Dark mode</);
assert.doesNotMatch(layout, />Light mode</);
assert.doesNotMatch(layout, /ThemeModeButton/);

const sidebarCss = readFileSync(new URL('./sidebar.css', import.meta.url), 'utf8');
const tokens = readFileSync(new URL('./sidebarTokens.css', import.meta.url), 'utf8');
assert.match(tokens, /--nav-theme-size:\s*32px/);
assert.match(sidebarCss, /\.sidebar-theme-toggle\s*\{[^}]*width:\s*var\(--nav-theme-size\)/);
assert.match(sidebarCss, /\.sidebar-theme-toggle\s*\{[^}]*background:\s*transparent/);
assert.match(sidebarCss, /\.sidebar-theme-toggle\s*\{[^}]*border-radius:\s*var\(--radius-sm\)/);

console.log('themeModeButton.check: ok');

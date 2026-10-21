/**
 * Runnable self-check for the sidebar theme icon.
 * Run: npx --yes tsx src/layouts/themeModeButton.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeModeButton } from './ThemeModeButton.tsx';

const dark = renderToStaticMarkup(
  createElement(ThemeModeButton, { theme: 'dark', onToggle: () => undefined }),
);
assert.match(dark, /class="layout-theme-toggle"/);
assert.match(dark, /aria-label="Dark mode"/);
assert.match(dark, /aria-pressed="true"/);
assert.match(dark, /<path /);
assert.doesNotMatch(dark, /<circle /);

const light = renderToStaticMarkup(
  createElement(ThemeModeButton, { theme: 'light', onToggle: () => undefined }),
);
assert.match(light, /aria-label="Light mode"/);
assert.match(light, /aria-pressed="false"/);
assert.match(light, /<circle /);

const layout = readFileSync(new URL('./Layout.tsx', import.meta.url), 'utf8');
const userCluster = layout.slice(
  layout.indexOf('layout-sidebar-user-meta'),
  layout.indexOf('layout-sidebar-signout'),
);
assert.match(userCluster, /ThemeModeButton/);
assert.doesNotMatch(layout, />Dark mode</);
assert.doesNotMatch(layout, />Light mode</);

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
assert.match(css, /\.layout-theme-toggle\s*\{[^}]*border-radius:\s*999px/);

console.log('themeModeButton.check: ok');

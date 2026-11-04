/**
 * Runnable self-check for the icon-only sidebar rail.
 * Run: npx --yes tsx src/layouts/sidebarCollapse.check.ts
 */
import './cssHook.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SIDEBAR_COLLAPSED_STORAGE_KEY, storedSidebarCollapsed } from './sidebarCollapse.ts';

const { SidebarCollapseButton } = await import('./SidebarCollapseButton.tsx');

assert.equal(SIDEBAR_COLLAPSED_STORAGE_KEY, 'flowra-sidebar-collapsed');
assert.equal(storedSidebarCollapsed(null), false);
assert.equal(storedSidebarCollapsed('false'), false);
assert.equal(storedSidebarCollapsed('true'), true);

const expanded = renderToStaticMarkup(
  createElement(SidebarCollapseButton, { isCollapsed: false, onToggle: () => undefined }),
);
assert.match(expanded, /class="sidebar-collapse"/);
assert.match(expanded, /aria-expanded="true"/);
assert.match(expanded, /aria-label="Collapse sidebar"/);
assert.doesNotMatch(expanded, /data-sidebar-item/);

const collapsed = renderToStaticMarkup(
  createElement(SidebarCollapseButton, { isCollapsed: true, onToggle: () => undefined }),
);
assert.match(collapsed, /aria-expanded="false"/);
assert.match(collapsed, /aria-label="Expand sidebar"/);

const layout = readFileSync(new URL('./Layout.tsx', import.meta.url), 'utf8');
assert.match(layout, /SidebarCollapseButton/);
assert.match(layout, /storedSidebarCollapsed/);
assert.match(layout, /is-collapsed/);
assert.match(layout, /!isCollapsed/);

const tokens = readFileSync(new URL('./sidebarTokens.css', import.meta.url), 'utf8');
assert.match(tokens, /--nav-rail-width:\s*72px/);

const sidebarCss = readFileSync(new URL('./sidebar.css', import.meta.url), 'utf8');
assert.match(sidebarCss, /\.layout-sidebar\.is-collapsed\s*\{[^}]*width:\s*var\(--nav-rail-width\)/);
assert.match(sidebarCss, /\.layout-sidebar\.is-collapsed \.sidebar-nav-item-label/);
assert.match(sidebarCss, /\.layout-sidebar\.is-collapsed \.sidebar-icon/);
assert.doesNotMatch(
  sidebarCss,
  /\.layout-sidebar\.is-collapsed \.sidebar-icon\s*\{[^}]*display:\s*none/,
);

console.log('sidebarCollapse.check: ok');

/**
 * Runnable self-check for the workspace switch under Cartography.
 * Run: npx --yes tsx src/layouts/workspaceModeNav.check.ts
 */
import './cssHook.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const { WorkspaceModeNav } = await import('./WorkspaceModeNav.tsx');

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const sidebarCss = readFileSync(new URL('./sidebar.css', import.meta.url), 'utf8');
const layout = readFileSync(new URL('./Layout.tsx', import.meta.url), 'utf8');

assert.match(layout, /WorkspaceModeNav/);
assert.match(layout, /graphMode: next/);
assert.match(css, /\.layout-sidebar \{[^}]*background: #d5dee8/);
assert.match(css, /\.self-service-side-menu \{[^}]*background: #ffffff/);
assert.match(sidebarCss, /\.sidebar-subnav \{[^}]*flex-direction: column/);
assert.match(sidebarCss, /\.sidebar-subnav::before\s*\{[^}]*width:\s*1px/);
assert.match(sidebarCss, /\.sidebar-subitem--production\.is-active\s*\{[^}]*var\(--nav-underline-production\)/);
assert.match(sidebarCss, /\.sidebar-subitem--sandbox\.is-active\s*\{[^}]*var\(--nav-underline-sandbox\)/);
assert.match(sidebarCss, /\.sidebar-subitem--views\.is-active\s*\{[^}]*var\(--nav-underline-views\)/);
assert.match(sidebarCss, /\.sidebar-subitem\.is-active\s*\{[^}]*text-decoration:\s*underline/);

function nav(mode: 'normal' | 'sandbox' | 'views' | null, sandboxDirty = false) {
  return renderToStaticMarkup(
    createElement(WorkspaceModeNav, {
      id: 'cartography-modes',
      mode,
      sandboxDirty,
      onModeChange: () => undefined,
    }),
  );
}

function button(html: string, id: string): string {
  const start = html.indexOf(`id="${id}"`);
  const end = html.indexOf('</button>', start);
  return html.slice(start, end);
}

const production = nav('normal');
assert.match(production, />Production</);
assert.match(production, />Sandbox</);
assert.match(production, />My views</);
assert.match(button(production, 'graph-mode-tab-normal'), /sidebar-subitem--production is-active/);
assert.match(button(production, 'graph-mode-tab-sandbox'), /sidebar-subitem--sandbox/);
assert.match(button(production, 'graph-mode-tab-views'), /sidebar-subitem--views/);
assert.doesNotMatch(button(production, 'graph-mode-tab-sandbox'), /is-active/);
assert.match(button(nav('sandbox'), 'graph-mode-tab-sandbox'), /is-active/);
assert.match(button(nav('views'), 'graph-mode-tab-views'), /is-active/);
assert.match(nav('sandbox', true), /Unsaved draft/);
assert.doesNotMatch(nav(null), /is-active/);

console.log('workspaceModeNav.check: ok');

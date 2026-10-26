/**
 * Runnable self-check for the workspace switch under Cartography.
 * Run: npx --yes tsx src/layouts/workspaceModeNav.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkspaceModeNav } from './WorkspaceModeNav.tsx';

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const layout = readFileSync(new URL('./Layout.tsx', import.meta.url), 'utf8');

assert.match(layout, /WorkspaceModeNav/);
assert.match(css, /\.layout-sidebar \{[^}]*background: #d5dee8/);
assert.match(css, /\.self-service-side-menu \{[^}]*background: #ffffff/);
assert.match(css, /\.layout-mode-list \{[^}]*flex-direction: column/);
assert.match(css, /\.layout-mode-item\.is-primary \{[^}]*text-decoration: underline/);
assert.doesNotMatch(
  css,
  /\.layout-mode-item:hover,\s*\.layout-mode-item:focus-visible \{[^}]*background:/,
);

function nav(mode: 'normal' | 'sandbox' | 'views' | null, sandboxDirty = false) {
  return renderToStaticMarkup(
    createElement(WorkspaceModeNav, {
      mode,
      sandboxDirty,
      onModeChange: () => undefined,
    }),
  );
}

const production = nav('normal');
assert.match(production, />Production</);
assert.match(production, />Sandbox</);
assert.match(production, />My views</);
assert.match(production, /layout-mode-item--explorer[^"]*is-primary/);
assert.doesNotMatch(production, /layout-mode-item--sandbox[^"]*is-primary/);
assert.match(nav('sandbox'), /layout-mode-item--sandbox[^"]*is-primary/);
assert.match(nav('views'), /layout-mode-item--views[^"]*is-primary/);
assert.match(nav('sandbox', true), /Unsaved draft/);
assert.doesNotMatch(nav(null), /is-primary/);

console.log('workspaceModeNav.check: ok');

/**
 * Cartography and Sandbox are sibling sidebar items. My views lives in the filter menu.
 * Run: npx --yes tsx src/layouts/workspaceModeNav.check.ts
 */
import './cssHook.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const layout = readFileSync(new URL('./Layout.tsx', import.meta.url), 'utf8');
const icons = readFileSync(new URL('./NavigationIcon.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const filterDrawer = readFileSync(
  new URL('../features/map/components/FilterDrawer.tsx', import.meta.url),
  'utf8',
);

assert.match(layout, /openWorkspaceMode\('normal'\)/);
assert.match(layout, /openWorkspaceMode\('sandbox'\)/);
assert.match(layout, /label="Sandbox"/);
assert.match(layout, /name="sandbox"/);
assert.match(layout, /isCurrent=\{isOnCartography && mode === 'normal'\}/);
assert.doesNotMatch(layout, /WorkspaceModeNav/);
assert.doesNotMatch(layout, /My views/);
assert.doesNotMatch(layout, />Production</);
assert.match(icons, /sandbox:\s*\{[^}]*paths:/);
assert.match(filterDrawer, /My views/);
assert.match(css, /\.self-service-side-menu \{[^}]*background: transparent/);
assert.match(
  css,
  /\.map-graph-panel\.is-menu-open \.self-service-side-menu-shell \{[^}]*position: absolute[^}]*min\(360px/,
);
assert.match(
  css,
  /\.self-service-tool-detail > :not\(\.graph-filter-drawer\),[^}]*border-radius: 16px/,
);
assert.match(css, /\.self-service-tool-detail \{[^}]*background: transparent/);
assert.match(css, /\.graph-filter-detail-list \.graph-drawer-checkbox-row:not\(\.graph-filter-select-all-row\)/);
assert.match(css, /\.graph-filter-compact-actions \{[^}]*background: transparent/);
assert.doesNotMatch(
  css,
  /\.self-service-tool-detail \.graph-filter-root-row,[\s\S]*?\{[^}]*box-shadow: 0 10px/,
);

console.log('workspaceModeNav.check: ok');

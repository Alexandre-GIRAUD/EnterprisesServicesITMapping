/**
 * Runnable self-check for the cartography side menu chrome.
 * Run: npx --yes tsx src/features/map/components/cartographyMenu.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SelfServiceBurger, SelfServiceSideMenu } from './SelfServiceSideMenu.tsx';
import { DEFAULT_MENU_WIDTH } from './sideMenuWidth.ts';

const css = readFileSync(new URL('../../../index.css', import.meta.url), 'utf8');

assert.equal(DEFAULT_MENU_WIDTH, 360);
assert.match(css, /\.map-graph-panel\.is-menu-open \.self-service-side-menu-shell \{[^}]*min\(360px/);
assert.doesNotMatch(css, /\.self-service[^{]*is-expanded/);
assert.match(css, /cubic-bezier\(0\.22, 1, 0\.36, 1\)/);
assert.doesNotMatch(css, /7\.25rem/);
assert.match(css, /\.graph-filter-compact-btn--pin:not\(:disabled\) \{[^}]*background: #16a34a/);
assert.doesNotMatch(css, /\.graph-filter-compact-actions > \.graph-filter-compact-btn \{[^}]*flex: 1 1 0/);
assert.match(css, /\.graph-filter-neighbours \{[^}]*gap: 0\.45rem[^}]*font-size: 0\.85rem[^}]*font-weight: 500[^}]*color: #334155/);
assert.match(readFileSync(new URL('./FilterDrawer.tsx', import.meta.url), 'utf8'), /with neighbours/);
assert.match(css, /\.graph-filter-compact-btn \{[^}]*font-size: 0\.85rem[^}]*border-radius: 8px/);
assert.match(css, /\.graph-drawer-action-danger-solid \{[^}]*background: #ffffff/);
assert.doesNotMatch(css, /linear-gradient\(180deg, #ef4444/);

Object.assign(globalThis, {
  window: {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    innerWidth: 1400,
    addEventListener() {},
    removeEventListener() {},
  },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
});

function menu(mode: 'normal' | 'sandbox' | 'views') {
  return renderToStaticMarkup(
    createElement(SelfServiceSideMenu, {
      isOpen: true,
      onToggle: () => undefined,
      graphMode: mode,
      filtersActive: false,
      activeTool: 'filters',
      onActiveToolChange: () => undefined,
      toolDetail: null,
    }),
  );
}

for (const mode of ['normal', 'sandbox', 'views'] as const) {
  const html = menu(mode);
  assert.doesNotMatch(html, />Views</);
  assert.doesNotMatch(html, /is-expanded/);
  assert.match(html, />Cartography</);
}
const productionMenu = menu('normal');
assert.doesNotMatch(productionMenu, />Changes</);
assert.doesNotMatch(productionMenu, />Production</);
assert.doesNotMatch(productionMenu, />Sandbox</);
assert.doesNotMatch(productionMenu, />My views</);

const openBurger = renderToStaticMarkup(createElement(SelfServiceBurger, { isOpen: true, onToggle: () => undefined }));
assert.match(openBurger, /self-service-burger-icon/);
assert.doesNotMatch(openBurger, /M18 6/);

const viewsMenu = menu('views');
assert.match(viewsMenu, /M18 6/);

console.log('cartographyMenu.check: ok');

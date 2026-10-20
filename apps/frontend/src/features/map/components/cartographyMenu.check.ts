/**
 * Runnable self-check for the cartography side menu chrome.
 * Run: npx --yes tsx src/features/map/components/cartographyMenu.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AttributeValueControl } from './AttributeValueControl.tsx';
import { SelfServiceBurger, SelfServiceSideMenu } from './SelfServiceSideMenu.tsx';
import { DEFAULT_MENU_WIDTH } from './sideMenuWidth.ts';

const css = readFileSync(new URL('../../../index.css', import.meta.url), 'utf8');

assert.equal(DEFAULT_MENU_WIDTH, 420);
assert.match(css, /\.map-graph-panel\.is-menu-open \.self-service-side-menu-shell \{[^}]*min\(420px/);
assert.doesNotMatch(css, /min\(360px, 92vw\)/);
assert.doesNotMatch(css, /\.is-expanded/);
assert.match(css, /cubic-bezier\(0\.22, 1, 0\.36, 1\)/);
assert.match(css, /\.self-service-view-list \{[^}]*flex-direction: row/);
assert.match(css, /\.self-service-view-list \{[^}]*flex-wrap: nowrap/);
assert.match(css, /\.self-service-view-item\.is-primary \{[^}]*text-decoration: underline/);
assert.doesNotMatch(
  css,
  /\.self-service-view-item:hover,\s*\.self-service-view-item:focus-visible \{[^}]*background:/,
);
assert.match(css, /\.map-graph-panel \.graph-filter-compact-btn--pin:not\(:disabled\) \{[^}]*background: #ffffff/);
assert.match(css, /\.map-graph-panel \.graph-filter-compact-btn--pin:not\(:disabled\) \{[^}]*color: #15803d/);
assert.match(css, /--action-button-width:\s*7\.25rem/);
assert.match(css, /\.graph-filter-compact-actions > \.graph-filter-compact-btn \{[^}]*width: var\(--action-button-width\)/);
assert.match(css, /\.pivot-btn \{[^}]*width: var\(--action-button-width\)/);
assert.match(css, /\.map-graph-panel \.pivot-btn--primary \{[^}]*background: var\(--ss-accent\)/);
assert.match(css, /\.map-graph-panel \.pivot-btn--primary:hover:not\(:disabled\) \{[^}]*background: var\(--ss-accent-dark\)/);
assert.match(css, /\.pivot-btn--danger \{[^}]*color: #b91c1c/);
assert.match(css, /\.graph-drawer-text-button\.is-danger \{[^}]*border: 1px solid #f87171/);
assert.match(css, /\.graph-drawer-text-button\.is-danger \{[^}]*color: #b91c1c/);
assert.match(
  css,
  /\.data-model-remove-btn \{\s*border: 1px solid #f87171;\s*background: #ffffff;\s*color: #b91c1c;/,
);
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
      sandboxDirty: false,
      filtersActive: false,
      activeTool: 'filters',
      onActiveToolChange: () => undefined,
      onModeChange: () => undefined,
      toolDetail: null,
    }),
  );
}

for (const mode of ['normal', 'sandbox', 'views'] as const) {
  const html = menu(mode);
  assert.doesNotMatch(html, />Views</);
  assert.doesNotMatch(html, /is-expanded/);
  assert.doesNotMatch(html, />Cartography</);
  assert.match(html, />Production</);
}
const productionMenu = menu('normal');
assert.doesNotMatch(productionMenu, />Changes</);
assert.match(productionMenu, />Production</);
assert.match(productionMenu, />Sandbox</);
assert.match(productionMenu, />My views</);
assert.match(productionMenu, /self-service-view-item--explorer[^"]*is-primary/);
assert.doesNotMatch(productionMenu, /self-service-view-item--sandbox[^"]*is-primary/);
assert.match(menu('sandbox'), /self-service-view-item--sandbox[^"]*is-primary/);
assert.match(menu('views'), /self-service-view-item--views[^"]*is-primary/);

const openBurger = renderToStaticMarkup(createElement(SelfServiceBurger, { isOpen: true, onToggle: () => undefined }));
assert.match(openBurger, /self-service-burger-icon/);
assert.match(openBurger, /<rect /);
assert.doesNotMatch(openBurger, /M18 6/);
assert.doesNotMatch(css, /\.self-service-burger-icon::before/);

const viewsMenu = menu('views');
assert.match(viewsMenu, /M18 6/);

const listMarkup = renderToStaticMarkup(
  createElement(AttributeValueControl, {
    field: { key: 'tags', label: 'Tags', enforceEnum: false, required: false, multiple: true },
    value: ['one'],
    disabled: false,
    onChange: () => undefined,
  }),
);
assert.match(listMarkup, /class="graph-drawer-text-button is-danger"[^>]*>Remove</);
assert.match(listMarkup, /class="graph-drawer-text-button"[^>]*>Add value</);
const dataModelSource = readFileSync(new URL('../../datamodel/pages/DataModelPage.tsx', import.meta.url), 'utf8');
assert.match(dataModelSource, /className="data-model-remove-btn"[\s\S]{0,120}Remove field/);

console.log('cartographyMenu.check: ok');

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
assert.match(
  css,
  /\.map-graph-panel \.graph-filter-compact-btn--views \{[^}]*border-color: #16a34a[^}]*background: #ffffff[^}]*color: #15803d/,
);
assert.match(
  css,
  /\.graph-filter-compact-btn--ghost:hover:not\(:disabled\) \{[^}]*color: #b91c1c/,
);
assert.match(
  readFileSync(new URL('./FilterDrawer.tsx', import.meta.url), 'utf8'),
  /graph-filter-compact-btn graph-filter-compact-btn--views/,
);
assert.match(
  css,
  /\.map-graph-panel\.is-menu-open \.self-service-side-menu-shell \{[^}]*position: relative[^}]*flex: 0 0 min\(360px, 92vw\)[^}]*overflow: hidden/,
);
assert.match(
  css,
  /\.map-graph-panel \.self-service-side-menu \{[^}]*border: 1px solid #e2e8f0[^}]*border-radius: 8px[^}]*background: #ffffff[^}]*overflow: hidden/,
);
assert.match(
  css,
  /\.map-graph-panel \.self-service-burger \{[^}]*border: 1px solid #cbd5e1[^}]*background: #ffffff/,
);
assert.doesNotMatch(
  css,
  /\.map-graph-panel \.self-service-side-menu \{[^}]*background: transparent/,
);
assert.doesNotMatch(css, /\.graph-filter-compact-actions > \.graph-filter-compact-btn \{[^}]*flex: 1 1 0/);
assert.match(css, /\.graph-filter-neighbours \{[^}]*gap: 0\.45rem[^}]*font-size: 0\.85rem[^}]*font-weight: 500[^}]*color: #334155/);
assert.match(readFileSync(new URL('./FilterDrawer.tsx', import.meta.url), 'utf8'), /With neighbours/);
const sideTools = readFileSync(new URL('./graphCanvasSideTools.tsx', import.meta.url), 'utf8');
assert.doesNotMatch(sideTools, /showWithNeighbours=\{!isSandbox\}/);
assert.match(sideTools, /initialWithNeighbours=\{isSandbox \? Boolean\(activeSandboxFilters\.withNeighbours\)/);
assert.match(sideTools, /withNeighbours: Boolean\(nextWithNeighbours\),\s*\},\s*dirty: true/);
assert.match(css, /\.graph-view-header-title \{[^}]*font-size: 1\.85rem[^}]*font-weight: 700[^}]*letter-spacing: -0\.03em/);
assert.match(css, /\.graph-view-header-description \{[^}]*font-size: 0\.95rem[^}]*line-height: 1\.5/);
assert.doesNotMatch(css, /\.graph-view-header \{[^}]*border-bottom/);
assert.match(css, /\.map-graph-panel \.graph-display-toggle \{[^}]*border-radius: 10px[^}]*background: #fff/);
assert.match(css, /\.map-graph-panel \.graph-display-toggle-btn\.is-active \{[^}]*background: var\(--ss-accent\)[^}]*color: #fff/);
assert.match(css, /\.map-graph-panel \.self-service-tool-bar-btn\.is-active \{[^}]*background: var\(--ss-accent\)[^}]*color: #fff/);
assert.match(css, /\.graph-canvas \{[^}]*border: 1px solid #e2e8f0[^}]*border-radius: 12px/);
assert.match(css, /\.sandbox-pane \{[^}]*border: 1px solid #e2e8f0[^}]*border-radius: 12px/);
// No coloured left border: the active Sandbox is the one whose title is underlined in the accent.
assert.doesNotMatch(css, /border-left: 3px solid var\(--ss-accent\)/);
assert.match(css, /\.sandbox-pane\.is-active \{[^}]*box-shadow: 0 8px 24px rgb\(15 23 42 \/ 6%\)/);
assert.match(css, /\.sandbox-pane\.is-active \.sandbox-pane__title \{[^}]*text-decoration: underline[^}]*text-decoration-color: var\(--ss-accent\)/);
// Sandbox titles float near the top of their board, below the floating chrome on the top row.
assert.match(css, /\.sandbox-pane__header \{[^}]*position: absolute[^}]*top: 0\.6rem/);
assert.match(css, /\.sandbox-pane\.is-top-row \.sandbox-pane__header \{[^}]*top: var\(--map-drawer-top\)/);
assert.match(readFileSync(new URL('./SandboxPane.tsx', import.meta.url), 'utf8'), /is-top-row/);
// The burger floats at a fixed spot: the close cross replaces it exactly, the menu starts below.
assert.match(css, /\.map-graph-panel \.self-service-burger \{[^}]*position: absolute[^}]*top: 0\.85rem[^}]*right: 1rem[^}]*z-index: 30/);
assert.match(css, /\.map-graph-panel \.self-service-side-menu-body \{[^}]*padding: calc\(0\.85rem \+ 36px \+ 0\.5rem\) 0\.65rem 0\.55rem/);
assert.equal((readFileSync(new URL('./GraphCanvas.tsx', import.meta.url), 'utf8').match(/<SelfServiceBurger/g) ?? []).length, 1);
// My views is indented like the Data Model page.
assert.match(css, /\.map-graph-panel\.is-views-mode \.graph-views-pane \{[^}]*padding-left: 1\.5rem[^}]*padding-right: 1\.5rem/);
// The title text carries 0.65rem of its own padding: the header gives the rest so title and list share one edge.
assert.match(css, /\.map-graph-panel\.is-views-mode \.graph-view-header \{[^}]*padding-left: calc\(1\.5rem - 0\.65rem\)/);
assert.match(css, /\.graph-views-item-btn \{[^}]*border: 1px solid #e2e8f0[^}]*border-radius: 12px/);
assert.match(css, /\.sandbox-pane__title \{[^}]*font-size: 0\.92rem[^}]*font-weight: 700[^}]*color: #0f172a/);
assert.match(css, /\.graph-filter-compact-btn \{[^}]*font-size: 0\.85rem[^}]*border-radius: 999px/);
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
  assert.doesNotMatch(html, />Cartography</);
  assert.doesNotMatch(html, /graph-drawer-close/);
}
const productionMenu = menu('normal');
assert.doesNotMatch(productionMenu, />Changes</);
assert.doesNotMatch(productionMenu, />Production</);
assert.doesNotMatch(productionMenu, />Sandbox</);
assert.doesNotMatch(productionMenu, />My views</);

const openBurger = renderToStaticMarkup(createElement(SelfServiceBurger, { isOpen: true, onToggle: () => undefined }));
assert.match(openBurger, /self-service-burger-icon/);
assert.doesNotMatch(openBurger, /M18 6/);
assert.match(css, /\.self-service-burger\.is-open \.self-service-burger-icon::before \{[^}]*rotate\(45deg\)[^}]*box-shadow: none/);
assert.match(css, /\.self-service-burger\.is-open \.self-service-burger-icon::after \{[^}]*rotate\(-45deg\)/);

assert.match(css, /--ss-bubble-shadow: 0 4px 12px rgb\(15 23 42 \/ 10%\)/);
assert.match(css, /\.self-service-tool-detail \.graph-filter-root-row,[^{]*\{[^}]*box-shadow: var\(--ss-bubble-shadow\)/);
assert.match(css, /\.self-service-tool-bar-btn \{[^}]*box-shadow: var\(--ss-bubble-shadow\)/);
assert.match(css, /\.graph-filter-compact-btn \{[^}]*box-shadow: var\(--ss-bubble-shadow\)/);

// Filter values scroll inside the menu instead of running off the screen.
assert.match(css, /\.self-service-tool-detail \{[^}]*flex: 0 1 auto[^}]*overflow-y: auto/);
assert.doesNotMatch(css, /\.self-service-tool-detail \.graph-filter-detail-list \{[^}]*overflow: visible/);

// One shape for Back, Clear, My views, Pin view and Done.
const filterDrawer = readFileSync(new URL('./FilterDrawer.tsx', import.meta.url), 'utf8');
assert.match(css, /\.graph-filter-compact-actions \{[^}]*display: flex[^}]*gap: 0\.4rem/);
assert.match(css, /\.graph-filter-compact-btn \{[^}]*flex: 1 1 0/);
assert.doesNotMatch(css, /not\(\.is-sandbox-mode\)/);
assert.match(css, /\.graph-filter-compact-btn--ghost \{[^}]*flex: 0 0 auto[^}]*border-color: #cbd5e1[^}]*background: #f8fafc/);
assert.equal((filterDrawer.match(/graph-filter-compact-btn--ghost/g) ?? []).length, 2);
assert.match(css, /\.graph-filter-neighbours:has\(input:checked\) \{[^}]*background: var\(--ss-accent-surface\)/);
assert.match(css, /\.graph-filter-neighbours-icon \{[^}]*border-radius: 50%/);
// The long hint shows only on hover, as a tooltip.
assert.doesNotMatch(filterDrawer, /graph-filter-neighbours-hint/);
assert.match(filterDrawer, /className="graph-filter-neighbours" title="Also show applications linked by a feed/);
assert.match(css, /\.graph-filter-compact-btn \{[^}]*min-height: 2\.25rem[^}]*padding: 0 0\.75rem/);
assert.doesNotMatch(css, /\.graph-filter-back-btn \{/);
assert.match(filterDrawer, /graph-filter-compact-btn graph-filter-compact-btn--neutral"[\s\S]{0,300}‹ Back/);

assert.match(css, /\.graph-filter-drawer-header \.graph-filter-compact-btn \{[^}]*flex: 0 0 auto/);

// With neighbours sits under the search as a switch row, not above the list.
assert.ok(filterDrawer.indexOf('graph-filter-search-input') < filterDrawer.indexOf('graph-filter-neighbours'));
assert.match(css, /\.graph-filter-neighbours \{[^}]*justify-content: space-between/);
assert.match(css, /\.graph-filter-neighbours input \{[^}]*appearance: none/);

assert.doesNotMatch(css, /\.sandbox-pane__icon/);
assert.doesNotMatch(readFileSync(new URL('./SandboxPane.tsx', import.meta.url), 'utf8'), /sandbox-pane__icon/);
assert.match(css, /\.sandbox-pane__title \{[^}]*text-align: center/);
assert.match(css, /\.sandbox-pane__close \{[^}]*position: absolute/);

// The tool tabs sit in a click-through menu: they must take clicks themselves (Chat and Corrections did not).
assert.match(css, /\.self-service-tool-bar \{[^}]*pointer-events: auto/);
// Every button of the menu reads as a button: a border, a shadow, a lift on hover.
assert.match(css, /\.map-graph-panel \.self-service-burger \{[^}]*border: 1px solid #cbd5e1[^}]*border-radius: 999px[^}]*box-shadow: var\(--ss-bubble-shadow\)/);
assert.match(css, /\.self-service-tool-bar-btn:hover[^{]*\{[^}]*transform: translateY\(-1px\)/);
assert.match(css, /\.graph-filter-compact-btn:hover[^{]*\{[^}]*transform: translateY\(-1px\)/);
assert.match(css, /\.self-service-burger:hover[^{]*\{[^}]*transform: translateY\(-1px\)/);
assert.match(css, /\.self-service-tool-bar-btn \{[^}]*border-radius: 999px/);
// With neighbours is one flat line, like the buttons.
assert.match(css, /\.graph-filter-neighbours \{[^}]*min-height: 2\.25rem/);
assert.match(css, /\.graph-filter-neighbours-text \{[^}]*flex-direction: row/);

assert.match(css, /--ss-bubble-shadow-hover: 0 6px 14px rgb\(15 23 42 \/ 14%\)/);
assert.doesNotMatch(css, /box-shadow: 0 6px 14px rgb\(15 23 42 \/ 14%\)/);

// One solid docked menu in every mode: Cartography, Tables, My views and Sandbox look alike.
assert.doesNotMatch(css, /\.map-graph-panel:is\(\.is-views-mode, \.is-sandbox-mode\)/);
assert.doesNotMatch(css, /\.map-graph-panel:not\(\.is-views-mode\):not\(\.is-sandbox-mode\)/);
// The floating buttons share one look in every mode, the burger included once it is open.
assert.doesNotMatch(css, /\.self-service-burger:hover,\s*\.self-service-burger\.is-open \{/);
assert.match(css, /\.map-graph-panel \.self-service-burger\.is-open \{[^}]*background: #ffffff[^}]*box-shadow: var\(--ss-bubble-shadow\)/);
assert.match(css, /\.map-graph-panel \.graph-export-menu-trigger \{[^}]*border-color: #cbd5e1[^}]*background: #ffffff[^}]*box-shadow: var\(--ss-bubble-shadow\)/);
assert.match(css, /\.map-graph-panel \.graph-display-toggle \{[^}]*background: #fff[^}]*box-shadow: var\(--ss-bubble-shadow\)/);
// The Tables column menu uses the same solid borders as the filter menu.
assert.match(css, /\.table-columns-picker__zone \{[^}]*border: 1px solid #e2e8f0/);
console.log('cartographyMenu.check: ok');

/**
 * Stylesheet rules shared by Cartography, Sandbox, Module view, Table view and My views.
 * Run: npx --yes tsx src/features/map/components/viewChrome.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const css = readFileSync(new URL('../../../index.css', import.meta.url), 'utf8');

const rule = (selector: string): string => {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `missing rule ${selector}`);
  return css.slice(start, css.indexOf('}', start));
};

// One page template: every pane fills the page edge to edge with the same background and no frame.
const frame = rule('.map-page :is(.graph-canvas, .graph-tables-view, .graph-views-pane, .module-graph-wrap)');
assert.match(frame, /border:\s*none/);
assert.match(frame, /border-radius:\s*0/);
assert.match(frame, /background:\s*var\(--map-canvas-bg\)/);

// One look for the corner controls: Export, Date, Graphs/Tables, Back to graph and the burger.
const corner = rule('.map-graph-panel .corner-control');
assert.match(corner, /height:\s*var\(--corner-control-height\)/);
assert.match(corner, /border-radius:\s*var\(--corner-control-radius\)/);
assert.match(corner, /box-shadow:\s*var\(--ss-bubble-shadow\)/);

const source = (file: string): string => readFileSync(new URL(file, import.meta.url), 'utf8');
for (const file of ['./GraphExportMenu.tsx', './TableExportMenu.tsx', './GraphCanvas.tsx']) {
  assert.match(source(file), /<CornerButton/, `${file} uses CornerButton`);
}
for (const file of ['./HistoryDatePicker.tsx', './GraphDisplayToggle.tsx', './TableContentToggle.tsx', './SelfServiceSideMenu.tsx']) {
  assert.match(source(file), /corner-control/, `${file} carries corner-control`);
}
assert.doesNotMatch(css, /\.module-map-back/);

// One header height: the legend, the drawers and the tables start under it, whatever the title says.
assert.match(css, /--map-header-height:\s*5\.1rem/);
assert.match(css, /--map-drawer-top:\s*var\(--map-header-height\)/);
assert.match(css, /--map-content-top:\s*var\(--map-header-height\)/);
assert.match(rule('\n.graph-view-header'),/height:\s*var\(--map-header-height\)/);
assert.match(rule('.graph-view-header-text'), /overflow:\s*hidden/);

// One details drawer: the modules drawer has no width or resize handle of its own.
assert.doesNotMatch(css, /\.module-drawer \{/);
assert.doesNotMatch(css, /module-drawer__grip/);
assert.doesNotMatch(source('./ApplicationModulesDrawer.tsx'), /module-drawer__grip|window\.addEventListener/);

// The corner controls, the title line and the burger cross share one centre line.
assert.match(css, /--map-title-line:\s*2\.75rem/);
assert.match(rule('\n.graph-view-header-title'), /line-height:\s*var\(--map-title-line\)/);
assert.match(css, /\.graph-view-header-actions \{[^}]*height:\s*var\(--map-title-line\)/);
assert.match(rule('.map-graph-panel .self-service-burger'), /top:\s*calc\(var\(--burger-top\) \+ 0\.2rem \+ \(var\(--map-title-line\) - var\(--corner-control-height\)\) \/ 2\)/);
// A square corner button has no side padding, so its icon sits in the middle.
assert.match(rule('.map-graph-panel .self-service-burger'), /padding:\s*0;/);
assert.match(rule('.self-service-burger-icon'), /height:\s*12px/);

// Tables use the plain Cartography background; only My views keeps the dots.
assert.doesNotMatch(css, /\.map-page :is\(\.graph-tables-view, \.graph-views-pane\) \{/);
assert.match(rule('.map-page .graph-views-pane'), /background:\s*var\(--map-dot-grid\)/);

// One loading, empty and error message for every view.
const { MapState } = await import('./MapState.tsx');
assert.equal(
  renderToStaticMarkup(createElement(MapState, { kind: 'loading' }, 'Loading…')),
  '<p class="map-state map-state--loading" role="status">Loading…</p>',
);
assert.equal(
  renderToStaticMarkup(createElement(MapState, { kind: 'error' }, 'Boom')),
  '<p class="map-state map-state--error" role="alert">Boom</p>',
);
assert.match(renderToStaticMarkup(createElement(MapState, { kind: 'empty' }, 'Nothing')), /map-state--empty/);
assert.match(rule('.map-state'), /color:/);
const legacy = /graph-table-message|graph-views-state|graph-canvas-status|graph-canvas-error|graph-canvas-hint/;
for (const file of ['ApplicationsTablePanel', 'FeedsTablePanel', 'CreateTablePanel', 'GraphViewsPanel', 'graphViewsChrome', 'ApplicationModuleGraph']) {
  assert.doesNotMatch(source(`./${file}.tsx`), legacy, `${file} uses MapState`);
}

// Tables and My views carry the same dot grid as the graph canvases (gap 16, dots #e2e8f0).
assert.match(css, /--map-dot-grid:\s*radial-gradient\([^;]*#e2e8f0[^;]*16px 16px/);


console.log('viewChrome.check: ok');

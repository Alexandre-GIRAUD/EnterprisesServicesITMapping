/**
 * Stylesheet rules shared by Cartography, Sandbox, Module view, Table view and My views.
 * Run: npx --yes tsx src/features/map/components/viewChrome.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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

console.log('viewChrome.check: ok');

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

console.log('viewChrome.check: ok');

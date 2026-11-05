/**
 * Runnable self-check: the module view is laid out like Cartography.
 * Run: npx --yes tsx src/features/map/components/moduleViewHarmony.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');
const canvas = read('./GraphCanvas.tsx');
const graph = read('./ApplicationModuleGraph.tsx');
const css = read('../../../index.css');

const rule = (selector: string): string => {
  const start = css.lastIndexOf(`\n${selector} {`);
  assert.ok(start >= 0, `missing rule ${selector}`);
  return css.slice(start, css.indexOf('}', start));
};

// No grey sentence under the "Modules" title.
const description = canvas.slice(canvas.indexOf('const tabDescription'), canvas.indexOf('const showGraphDisplayToggle'));
assert.doesNotMatch(description, /Module dependency tree/);

// "Back to graph" lives in the header actions, beside the other buttons, never under the title.
const header = canvas.slice(canvas.indexOf('<header className="graph-view-header">'), canvas.indexOf('</header>'));
assert.match(header, /Back to graph/);
assert.doesNotMatch(canvas, /module-map-toolbar/);
assert.match(rule('.module-map-back'), /box-shadow:\s*var\(--ss-bubble-shadow\)/);
assert.match(rule('.module-map-back'), /border:\s*1px solid #cbd5e1/);

// The canvas fills the stage like Cartography's: nothing is padded above it, and the drawer starts at the same top.
assert.doesNotMatch(css.slice(css.indexOf('.map-graph-main .graph-tables-view,'), css.indexOf('.map-page .graph-canvas,')), /graph-module-drilldown/);
assert.match(rule('.module-map-canvas'), /height:\s*100%/);

// Same zoom stack as Cartography: zoom, center and full screen, no fit-view button.
assert.match(graph, /showFitView=\{false\}/);
assert.match(graph, /<CenterGraphControl/);
assert.match(graph, /<FullscreenControl/);

// Entering the module view folds the burger menu; the user opens it by clicking.
const open = canvas.slice(canvas.indexOf('const openModuleGraphById'), canvas.indexOf('const openModuleGraph = '));
assert.match(open, /setIsSideMenuOpen\(false\)/);

console.log('moduleViewHarmony.check: ok');

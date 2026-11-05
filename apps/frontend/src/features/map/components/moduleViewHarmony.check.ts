/**
 * Runnable self-check: the module view is laid out like Cartography.
 * Run: npx --yes tsx src/features/map/components/moduleViewHarmony.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');
const canvas = read('./GraphCanvas.tsx');
const graph = read('./ApplicationModuleGraph.tsx');
const cssSource = read('../../../index.css');

const extractCssRule = (selector: string): string => {
  const start = cssSource.lastIndexOf(`\n${selector} {`);
  assert.ok(start >= 0, `missing rule ${selector}`);
  return cssSource.slice(start, cssSource.indexOf('}', start));
};

// No grey sentence under the "Modules" title.
const description = canvas.slice(canvas.indexOf('const tabDescription'), canvas.indexOf('const showGraphDisplayToggle'));
assert.doesNotMatch(description, /Module dependency tree/);

// "Back to graph" lives in the header actions, beside the other buttons, never under the title.
const header = canvas.slice(canvas.indexOf('<header className="graph-view-header">'), canvas.indexOf('</header>'));
assert.match(header, /Back to graph/);
assert.match(header, /<CornerButton/);
assert.doesNotMatch(canvas, /module-map-toolbar/);
assert.match(extractCssRule('.map-graph-panel .corner-control'), /box-shadow:\s*var\(--ss-bubble-shadow\)/);
assert.match(extractCssRule('.map-graph-panel .corner-control'), /border:\s*1px solid #cbd5e1/);

// The canvas fills the stage like Cartography's: nothing is padded above it, and the drawer starts at the same top.
assert.doesNotMatch(cssSource.slice(cssSource.indexOf('.map-graph-main .graph-tables-view,'), cssSource.indexOf('.map-page :is(.graph-canvas,')), /graph-module-drilldown/);
assert.match(extractCssRule('.module-map-canvas'), /height:\s*100%/);

// Same zoom stack as Cartography: zoom, center and full screen, no fit-view button.
assert.match(graph, /showFitView=\{false\}/);
assert.match(graph, /<CenterGraphControl/);
assert.match(graph, /<FullscreenControl/);

// Entering the module view folds the burger menu; the user opens it by clicking.
const openModuleSource = canvas.slice(canvas.indexOf('const openModuleGraphById'), canvas.indexOf('const openModuleGraph = '));
assert.match(openModuleSource, /setIsSideMenuOpen\(false\)/);

// A long title is cut with an ellipsis and keeps its full text in a tooltip, so it never wraps over the legend.
assert.match(canvas, /<h2 className="graph-view-header-title" title=\{activeViewTitle\}>/);
const titleRule = extractCssRule('.graph-view-header-title');
assert.match(titleRule, /white-space:\s*nowrap/);
assert.match(titleRule, /overflow:\s*hidden/);
assert.match(titleRule, /text-overflow:\s*ellipsis/);
// The title box keeps a floor width, otherwise the actions squeeze it down to nothing.
assert.match(extractCssRule('.graph-view-header-text'), /min-width:\s*9rem/);

console.log('moduleViewHarmony.check: ok');

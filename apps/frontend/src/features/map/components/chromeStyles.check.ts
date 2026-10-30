/**
 * Stylesheet rules: invisible resize handles, wide legend groups on one line.
 * Run: npx --yes tsx src/features/map/components/chromeStyles.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../../index.css', import.meta.url), 'utf8');

const rule = (selector: string): string => {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `missing rule ${selector}`);
  return css.slice(start, css.indexOf('}', start));
};

assert.match(rule('.graph-canvas .react-flow__resize-control.handle'), /background:\s*transparent/);
assert.match(rule('.graph-canvas .react-flow__resize-control.handle'), /border:\s*none/);
assert.match(rule('.graph-canvas .react-flow__resize-control.line'), /border-color:\s*transparent/);

const container = css.match(/@container[^{]*\{[\s\S]*?\n\}/);
assert.ok(container, 'missing @container rule for the wide legend');
assert.match(container[0], /graph-legend__group--apps/);
assert.match(container[0], /graph-legend__group--flows/);
assert.match(container[0], /flex-direction:\s*row/);
// A short legend, not a wide one, triggers the side-by-side layout.
const condition = /@container([^{]*)\{/.exec(container[0])?.[1] ?? '';
assert.match(condition, /max-height/);
assert.doesNotMatch(condition, /min-width:\s*3\d/);
assert.match(css.slice(css.indexOf('.graph-legend:not(.is-concealed) {')), /container-type:\s*size/);
// Titles line up with the first row of their controls.
assert.match(container[0], /align-items:\s*baseline/);
assert.doesNotMatch(container[0], /padding-top/);

console.log('chromeStyles.check: ok');

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

console.log('chromeStyles.check: ok');

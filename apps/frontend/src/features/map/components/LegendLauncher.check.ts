/**
 * Collapsed legend launcher and compact edit control row.
 * Run: npx --yes tsx src/features/map/components/LegendLauncher.check.ts
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LegendControlRow } from './LegendControlRow.tsx';
import { LegendLauncher } from './LegendLauncher.tsx';

const noop = () => undefined;

const launcher = renderToStaticMarkup(createElement(LegendLauncher, { onClick: noop }));
assert.match(launcher, /<button\b[^>]*aria-label="Show legend"/);
assert.match(launcher, />L<\/button>/);
assert.doesNotMatch(launcher, /Legend</);

const row = renderToStaticMarkup(
  createElement(
    LegendControlRow,
    {
      label: 'App fill',
      trailing: createElement('input', { type: 'color', readOnly: true }),
      children: createElement('select', { 'aria-label': 'fill' }),
    },
  ),
);
assert.match(row, /class="graph-legend__control graph-legend__control--row"/);
assert.ok(row.indexOf('App fill') < row.indexOf('<select'));
assert.ok(row.indexOf('<select') < row.indexOf('type="color"'));

const plainRow = renderToStaticMarkup(
  createElement(LegendControlRow, { label: 'Flow label', children: createElement('select') }),
);
assert.doesNotMatch(plainRow, /graph-legend__control-end/);

console.log('LegendLauncher.check: ok');

/**
 * Runnable self-check for the Corrections toolbar mark (no test runner in frontend).
 * Run: npx --yes tsx src/features/map/components/SelfServiceToolBar.check.ts
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SelfServiceToolBar } from './SelfServiceToolBar.tsx';

const html = renderToStaticMarkup(
  createElement(SelfServiceToolBar, {
    graphMode: 'normal',
    filtersActive: false,
    activeTool: 'actions',
    onChange: () => undefined,
  }),
);

const correctionsButton = html.split('aria-label="Corrections"')[1]?.split('</button>')[0] ?? '';

assert.ok(correctionsButton.length > 0, 'Corrections button missing');
assert.match(correctionsButton, /viewBox="0 0 20 20"/);
assert.match(correctionsButton, /width="18"/);
assert.match(correctionsButton, /<rect\b/, 'Corrections icon should be a card');
assert.match(correctionsButton, /<path\b/, 'Corrections icon should include a pencil');
assert.doesNotMatch(
  correctionsButton,
  /M7\.2 4\.2/,
  'Corrections icon should no longer be crossed rectangles',
);

const sandboxHtml = renderToStaticMarkup(
  createElement(SelfServiceToolBar, {
    graphMode: 'sandbox',
    filtersActive: false,
    activeTool: 'filters',
    onChange: () => undefined,
  }),
);

const productionTabs = html.match(/role="tab"/g) ?? [];
assert.equal(productionTabs.length, 3, 'Production shows filters, corrections, and chat');
assert.match(html, /aria-label="Chat"/);

const sandboxTabs = sandboxHtml.match(/role="tab"/g) ?? [];
assert.equal(sandboxTabs.length, 3, 'Sandbox keeps three tools');
assert.doesNotMatch(sandboxHtml, /aria-label="Chat"/);
assert.match(sandboxHtml, /aria-label="Filters"/);
assert.match(sandboxHtml, /aria-label="Toolkit"/);
assert.match(sandboxHtml, /aria-label="My sandboxes"/);
assert.doesNotMatch(sandboxHtml, /Search applications/);

console.log('SelfServiceToolBar.check: ok');

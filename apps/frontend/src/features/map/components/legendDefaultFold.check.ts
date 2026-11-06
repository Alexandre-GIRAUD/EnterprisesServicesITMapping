/**
 * The module view starts with its legend folded into the launcher; Cartography and Sandbox do not.
 * Run: npx --yes tsx src/features/map/components/legendDefaultFold.check.ts
 */
import '../../../layouts/cssHook.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const { GraphLegend } = await import('./GraphLegend.tsx');

const folded = renderToStaticMarkup(createElement(GraphLegend, { nodeTypes: ['Application'], startsConcealed: true }));
assert.match(folded, /graph-legend is-concealed/);
assert.match(folded, /aria-label="Show legend"/);

const open = renderToStaticMarkup(createElement(GraphLegend, { nodeTypes: ['Application'] }));
assert.doesNotMatch(open, /is-concealed/);

const moduleGraph = readFileSync(new URL('./ApplicationModuleGraph.tsx', import.meta.url), 'utf8');
assert.match(moduleGraph, /<GraphLegend[^>]*startsConcealed/);

console.log('legendDefaultFold.check: ok');

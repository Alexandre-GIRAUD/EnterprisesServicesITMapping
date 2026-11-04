/**
 * The recenter control is a stroked target. The zoom-control fill must not turn it into a disc.
 * Run: npx --yes tsx src/features/map/components/centerGraphIcon.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const control = readFileSync(new URL('./CenterGraphControl.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../../index.css', import.meta.url), 'utf8');

assert.match(control, /className="center-graph-icon"/);
assert.match(control, /strokeWidth="1\.35"/);
assert.doesNotMatch(control, /strokeWidth="2\.2"/);
assert.match(
  css,
  /\.graph-canvas \.react-flow__controls-button svg\.center-graph-icon,\s*\.graph-canvas \.react-flow__controls-button svg\.center-graph-icon \* \{[^}]*fill: none/,
);

console.log('centerGraphIcon.check: ok');

/**
 * Runnable self-check for the diagram resize rule.
 * Run: npx --yes tsx src/features/map/components/diagramFrame.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveNextDiagramHeight } from './diagramFrame.ts';

assert.equal(resolveNextDiagramHeight(640, 640), null);
assert.equal(resolveNextDiagramHeight(640, 648), null);
assert.equal(resolveNextDiagramHeight(640, 700), 700);

const css = readFileSync(new URL('../../../index.css', import.meta.url), 'utf8');
assert.match(css, /\.layout \{[^}]*height: 100dvh/);
assert.match(css, /body\.is-diagram-grown/);
assert.match(css, /\.diagram-resize-handle/);

console.log('diagramFrame.check: ok');

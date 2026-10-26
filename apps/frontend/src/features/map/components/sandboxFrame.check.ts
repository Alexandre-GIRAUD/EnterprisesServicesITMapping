/**
 * Sandbox boards fill the cartography screen without a background frame.
 * Edge labels stack above arrow strokes.
 * Run: npx --yes tsx src/features/map/components/sandboxFrame.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../../index.css', import.meta.url), 'utf8');

const stage = css.match(/\.graph-canvas\.is-sandbox \{[^}]*\}/);
assert.ok(stage, 'sandbox stage rule missing');
assert.match(stage[0], /background: transparent/);
assert.match(stage[0], /border: none/);
assert.match(stage[0], /box-shadow: none/);

const board = css.match(/\.sandbox-board \{[^}]*\}/);
assert.ok(board, 'sandbox board rule missing');
assert.match(board[0], /padding: 0/);
assert.match(board[0], /width: 100%/);
assert.match(board[0], /height: 100%/);

const single = css.match(/\.sandbox-board--single \{[^}]*\}/);
assert.ok(single, 'single sandbox rule missing');
assert.match(single[0], /grid-template-columns: 1fr/);
assert.match(single[0], /grid-template-rows: 1fr/);

const pane = css.match(/\.sandbox-pane \{[^}]*\}/);
assert.ok(pane, 'sandbox pane rule missing');
assert.match(pane[0], /border: 1px solid/);

const edges = css.match(/\.graph-canvas \.react-flow__edges,\s*\.sandbox-pane \.react-flow__edges \{[^}]*\}/);
const labels = css.match(
  /\.graph-canvas \.react-flow__edgelabel-renderer,\s*\.sandbox-pane \.react-flow__edgelabel-renderer \{[^}]*\}/,
);
assert.ok(edges && labels, 'edge stacking rules missing');
const edgeLayer = Number(edges[0].match(/z-index:\s*(\d+)/)?.[1]);
const labelLayer = Number(labels[0].match(/z-index:\s*(\d+)/)?.[1]);
assert.ok(labelLayer > edgeLayer);

console.log('sandboxFrame.check: ok');

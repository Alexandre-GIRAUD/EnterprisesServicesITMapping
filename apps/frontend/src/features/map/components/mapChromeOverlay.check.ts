/**
 * Runnable self-check for the cartography chrome floating over a full-bleed map.
 * Run: npx --yes tsx src/features/map/components/mapChromeOverlay.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../../index.css', import.meta.url), 'utf8');

assert.match(css, /\.layout-main:has\(\.map-page\) \{[^}]*padding: 0/);
assert.match(css, /\.map-graph-main \{[^}]*--map-chrome-clearance: 8\.5rem[^}]*margin: 0/);
assert.match(css, /\.graph-view-header \{[^}]*position: absolute[^}]*z-index: 22[^}]*pointer-events: none/);
assert.doesNotMatch(css, /\.graph-view-header \{[^}]*border-bottom/);
assert.match(css, /\.graph-view-header-text,\s*\.graph-view-header-actions \{[^}]*pointer-events: auto/);
assert.match(css, /\.map-graph-main \.react-flow__panel\.top \{[^}]*top: var\(--map-chrome-clearance\)/);
assert.match(css, /\.map-graph-main \.react-flow__panel\.top\.left \{[^}]*top: var\(--map-drawer-top\)/);
assert.match(css, /\.map-page \.graph-canvas,\s*\.map-page \.graph-views-pane \{[^}]*border-radius: 0/);
assert.match(
  css,
  /\.map-page \.graph-details-drawer:not\(\.is-embedded\) \{[^}]*top: var\(--map-drawer-top\)[^}]*background: rgb\(248 250 252 \/ 84%\)/,
);
assert.doesNotMatch(css, /\.map-page \.graph-details-drawer:not\(\.is-embedded\) \{[^}]*top: var\(--map-chrome-clearance\)/);

console.log('mapChromeOverlay.check: ok');

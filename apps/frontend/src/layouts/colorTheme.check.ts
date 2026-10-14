/**
 * Runnable self-check for the header color theme.
 * Run: npx --yes tsx src/layouts/colorTheme.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { storedColorTheme, toggledColorTheme } from './colorTheme.ts';

assert.equal(storedColorTheme(null), 'light');
assert.equal(storedColorTheme('light'), 'light');
assert.equal(storedColorTheme('dark'), 'dark');
assert.equal(storedColorTheme('nope'), 'light');
assert.equal(toggledColorTheme('light'), 'dark');
assert.equal(toggledColorTheme('dark'), 'light');

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
assert.match(css, /html\[data-theme='dark'\][\s\S]*filter:\s*invert\(1\)\s*hue-rotate\(180deg\)/);
assert.match(css, /\.react-flow__node/);
assert.match(css, /\.react-flow__edge/);
assert.match(css, /\.graph-legend__swatch img/);

console.log('colorTheme.check: ok');

/**
 * Runnable self-check for the "applications to map" alert.
 * Run: npx --yes tsx src/features/sources/components/SourceMappingAlert.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const alert = readFileSync(new URL('./SourceMappingAlert.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../../index.css', import.meta.url), 'utf8');

assert.match(alert, /className="source-mapping-alert-close"/);
assert.match(alert, /aria-label="Close"/);
assert.match(alert, /if \(isDismissed \|\| alerts\.length === 0\) return null;/);
assert.match(alert, /setIsDismissed\(true\)/);

const mapRule = css.match(/\.map-page \.source-mapping-alert \{[^}]*\}/)?.[0] ?? '';
const zIndex = Number(mapRule.match(/z-index: (\d+)/)?.[1]);
const highestOtherZIndex = Math.max(
  ...[...css.replace(mapRule, '').matchAll(/z-index: (\d+)/g)].map((match) => Number(match[1])),
);
assert.ok(zIndex > highestOtherZIndex, `alert z-index ${zIndex} must top every other layer (${highestOtherZIndex})`);
assert.match(css, /\.source-mapping-alert-close \{[^}]*position: absolute/);

console.log('SourceMappingAlert.check: ok');

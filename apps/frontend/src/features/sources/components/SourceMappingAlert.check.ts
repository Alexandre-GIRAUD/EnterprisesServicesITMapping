/**
 * Runnable self-check for the "applications to map" alert.
 * Run: npx --yes tsx src/features/sources/components/SourceMappingAlert.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const alert = readFileSync(new URL('./SourceMappingAlert.tsx', import.meta.url), 'utf8');
const sourcesPanel = readFileSync(new URL('./DataSourcesPanel.tsx', import.meta.url), 'utf8');
const mapPage = readFileSync(new URL('../../map/pages/MapPage.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../../index.css', import.meta.url), 'utf8');

assert.match(alert, /className="source-mapping-alert-close"/);
assert.match(alert, /aria-label="Close"/);
assert.match(alert, /if \(isDismissed \|\| alerts\.length === 0\) return null;/);
assert.match(alert, /setIsDismissed\(true\)/);
assert.match(css, /\.source-mapping-alert-close \{[^}]*position: absolute/);

// The alert lives in Sources > Data sources only: Cartography opens without it.
assert.match(sourcesPanel, /<SourceMappingAlert /);
assert.doesNotMatch(mapPage, /SourceMappingAlert/);
assert.doesNotMatch(css, /\.map-page \.source-mapping-alert/);

console.log('SourceMappingAlert.check: ok');

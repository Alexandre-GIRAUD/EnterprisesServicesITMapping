/**
 * The corrections menu already titles the panel. Opening a form must not add a second one.
 * Run: npx --yes tsx src/features/map/components/correctionsFormHeader.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const drawer = readFileSync(new URL('./WorkspaceDrawer.tsx', import.meta.url), 'utf8');
const headerStart = drawer.indexOf('{showMenuHeader ? (');
const header = drawer.slice(headerStart, drawer.indexOf('graph-drawer-title-row', headerStart));

const guardAt = header.indexOf('!isEmbedded');
const eyebrowAt = header.indexOf('graph-drawer-eyebrow');
assert.ok(guardAt >= 0 && eyebrowAt > guardAt, 'the form eyebrow is skipped inside the corrections menu');

console.log('correctionsFormHeader.check: ok');

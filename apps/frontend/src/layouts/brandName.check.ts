/**
 * The sidebar, the sign-in mark, and the about page use the product name Flowra.
 * Run: npx --yes tsx src/layouts/brandName.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function readSource(relativePath: string): string {
  return readFileSync(join(here, relativePath), 'utf8');
}

const layout = readSource('Layout.tsx');
const login = readSource('../features/auth/pages/LoginPage.tsx');
const about = readSource('../features/about/AboutPage.tsx');
const css = readSource('../index.css');

assert.match(layout, /<h1>Flowra<\/h1>/);
assert.doesNotMatch(layout, /<h1>Flora<\/h1>/);
assert.match(login, /auth-brand-title">Flowra</);
assert.doesNotMatch(login, />Flora</);
assert.match(about, />Flowra</);
assert.doesNotMatch(about, />Flora</);
assert.match(layout, /to="\/about"/);
assert.match(css, /\.layout-main \{[^}]*overflow: auto/);

console.log('brandName.check: ok');

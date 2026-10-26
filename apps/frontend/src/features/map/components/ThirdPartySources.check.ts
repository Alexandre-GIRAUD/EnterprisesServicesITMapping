/**
 * Runnable self-check for Sources third-party import.
 * Run: npx --yes tsx src/features/map/components/ThirdPartySources.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sources = readFileSync(new URL('../pages/GitHubImportPage.tsx', import.meta.url), 'utf8');
const drawer = readFileSync(new URL('./ApplicationDetailsDrawer.tsx', import.meta.url), 'utf8');
const panel = readFileSync(new URL('./ThirdPartySources.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../../index.css', import.meta.url), 'utf8');

assert.doesNotMatch(sources, /github-import-eyebrow/);
assert.match(sources, /Import sources/);
assert.match(sources, /Repository/);
assert.match(sources, /Third party/);
assert.match(sources, /Scan connections and attributes/);
assert.doesNotMatch(sources, /Suggest connections \(AI\)/);
assert.match(drawer, /Scan connections and attributes/);
assert.doesNotMatch(drawer, /Suggérer les connexions/);
assert.match(sources, /github-import-panel/);
assert.match(sources, /GITHUB_MARK_PATH/);
assert.doesNotMatch(sources, /Suggérer/);
assert.doesNotMatch(sources, /Dépôts/);
assert.doesNotMatch(sources, /Name a third-party/);
assert.match(panel, /github-import-third-party-form/);
assert.match(panel, /importThirdPartyText/);
assert.match(panel, /importThirdPartyFile/);
assert.doesNotMatch(panel, /github-import-list/);
assert.doesNotMatch(panel, /Suggest modules/);
assert.match(css, /\.github-import-third-party-form \{[^}]*flex-direction: column/);
assert.doesNotMatch(drawer, /Save document/);
assert.doesNotMatch(drawer, /suggestModulesFromDocument/);
assert.doesNotMatch(drawer, /suggestConnectionsFromDocument/);
assert.match(drawer, /suggestModulesFromGithub/);
assert.match(drawer, /suggestConnectionsFromGithub/);
assert.match(drawer, /isGitHubLinkedApplication/);

/**
 * Runnable self-check for Sources third-party import.
 * Run: npx --yes tsx src/features/map/components/ThirdPartySources.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { thirdPartyApplications } from '../utils/thirdPartyApplications.ts';

const listed = thirdPartyApplications([
  { id: 'billing', name: 'Billing', description: 'Pays invoices' },
  { id: 'repo', name: 'acme/billing', description: '' },
  { id: 'marked', name: 'Docs', description: 'GitHub: https://github.com/acme/billing' },
  { id: 'sandbox-app-1', name: 'Draft', description: '' },
]);

assert.deepEqual(
  listed.map((application) => application.id),
  ['billing']
);

const sources = readFileSync(new URL('../pages/GitHubImportPage.tsx', import.meta.url), 'utf8');
const drawer = readFileSync(
  new URL('./ApplicationDetailsDrawer.tsx', import.meta.url),
  'utf8'
);
const panel = readFileSync(new URL('./ThirdPartySources.tsx', import.meta.url), 'utf8');

assert.match(sources, /Repository/);
assert.match(sources, /Third party/);
assert.match(sources, /Import selection/);
assert.match(panel, /Suggest modules/);
assert.match(panel, /Suggest connections/);
assert.match(panel, /importThirdPartyText/);
assert.match(panel, /importThirdPartyFile/);
assert.doesNotMatch(drawer, /Save document/);
assert.doesNotMatch(drawer, /suggestModulesFromDocument/);
assert.doesNotMatch(drawer, /suggestConnectionsFromDocument/);
assert.match(drawer, /suggestModulesFromGithub/);
assert.match(drawer, /suggestConnectionsFromGithub/);
assert.match(drawer, /isGitHubLinkedApplication/);

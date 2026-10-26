/**
 * Several selected repositories become one application. One repository keeps the repo name.
 * Run: npx --yes tsx src/features/map/utils/multiRepoImport.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applicationDescriptionForGitHubRepos,
  applicationMatchesGitHubRepo,
  descriptionWithAdditionalGitHubRepos,
  gitHubFullNamesInText,
} from './githubLinkedApplication.ts';

const billing = {
  description: 'API',
  htmlUrl: 'https://github.com/acme/billing-api',
};
const web = {
  description: 'UI',
  htmlUrl: 'https://github.com/acme/billing-web',
};

const description = applicationDescriptionForGitHubRepos([billing, web]);
assert.equal(
  description,
  'API\nUI\nGitHub: https://github.com/acme/billing-api\nGitHub: https://github.com/acme/billing-web',
);
assert.deepEqual(gitHubFullNamesInText(description), ['acme/billing-api', 'acme/billing-web']);

const checkout = { name: 'Checkout', description };
assert.equal(
  applicationMatchesGitHubRepo(checkout, { name: 'billing-web', fullName: 'acme/billing-web' }),
  true,
);
assert.equal(
  applicationMatchesGitHubRepo(checkout, { name: 'payments', fullName: 'acme/payments' }),
  false,
);

assert.equal(
  descriptionWithAdditionalGitHubRepos(
    'API\nGitHub: https://github.com/acme/billing-api',
    [web],
  ),
  'API\nGitHub: https://github.com/acme/billing-api\nUI\nGitHub: https://github.com/acme/billing-web',
);

const page = readFileSync(new URL('../pages/GitHubImportPage.tsx', import.meta.url), 'utf8');
assert.match(page, /name: applicationNameForGitHubRepo\(repo\.name\)/);
assert.match(page, /applicationDescriptionForGitHubRepos\(toCreate\)/);
assert.match(page, /Create New/);
assert.match(page, /role="dialog"/);
assert.match(page, /aria-modal="true"/);
assert.match(page, /replaceExisting: true/);
assert.doesNotMatch(page, /value="private"/);

const drawer = readFileSync(
  new URL('../components/ApplicationDetailsDrawer.tsx', import.meta.url),
  'utf8',
);
assert.match(drawer, /Repositories/);
assert.match(drawer, /gitHubFullNamesInText\(details\?\.description\)/);

console.log('multiRepoImport.check: ok');

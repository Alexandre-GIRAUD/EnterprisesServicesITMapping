/**
 * Bitbucket sits on Sources as its own tab. The token field lives on Settings.
 * Run: npx --yes tsx src/features/map/utils/bitbucketSources.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applicationDescriptionForBitbucketRepo,
  applicationMatchesBitbucketRepo,
  applicationNameForBitbucketRepo,
} from './bitbucketLinkedApplication.ts';

assert.equal(applicationNameForBitbucketRepo('acme/billing-api'), 'billing-api');
assert.equal(
  applicationDescriptionForBitbucketRepo('Invoices', 'https://bitbucket.org/acme/billing-api'),
  'Invoices\nBitbucket: https://bitbucket.org/acme/billing-api',
);
assert.equal(
  applicationMatchesBitbucketRepo(
    {
      name: 'billing-api',
      description: 'Bitbucket: https://bitbucket.org/acme/billing-api',
    },
    { name: 'billing-api', fullName: 'acme/billing-api' },
  ),
  true,
);
assert.equal(
  applicationMatchesBitbucketRepo(
    { name: 'billing-api', description: 'GitHub: https://github.com/acme/billing-api' },
    { name: 'billing-api', fullName: 'acme/billing-api' },
  ),
  false,
);

const settings = readFileSync(new URL('../../auth/pages/SettingsPage.tsx', import.meta.url), 'utf8');
const sources = readFileSync(new URL('../pages/GitHubImportPage.tsx', import.meta.url), 'utf8');
const help = readFileSync(new URL('../../../layouts/helpTopics.ts', import.meta.url), 'utf8');

assert.match(settings, /BitbucketTokenSettings/);
assert.match(sources, /Bitbucket/);
assert.match(sources, /Import repositories from the GitHub or Bitbucket account connected in Settings/);
assert.doesNotMatch(sources, /name="bitbucket-token"/);
assert.match(help, /Bitbucket/);

console.log('bitbucketSources.check: ok');

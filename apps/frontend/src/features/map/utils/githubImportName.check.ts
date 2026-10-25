/**
 * An imported repository is stored under the repo name, not owner/repo.
 * Run: npx --yes tsx src/features/map/utils/githubImportName.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applicationDescriptionForGitHubRepo,
  applicationNameForGitHubRepo,
  isGitHubLinkedApplication,
} from './githubLinkedApplication.ts';

assert.equal(applicationNameForGitHubRepo('octocat/Hello-World'), 'Hello-World');
assert.equal(applicationNameForGitHubRepo('Hello-World'), 'Hello-World');

assert.equal(
  applicationDescriptionForGitHubRepo('Says hello', 'https://github.com/octocat/Hello-World'),
  'Says hello\nGitHub: https://github.com/octocat/Hello-World',
);
assert.equal(
  applicationDescriptionForGitHubRepo('', 'https://github.com/octocat/Hello-World'),
  'GitHub: https://github.com/octocat/Hello-World',
);

assert.equal(
  isGitHubLinkedApplication({
    name: 'Hello-World',
    description: 'Says hello\nGitHub: https://github.com/octocat/Hello-World',
  }),
  true,
);

const page = readFileSync(new URL('../pages/GitHubImportPage.tsx', import.meta.url), 'utf8');
assert.match(page, /name: applicationNameForGitHubRepo\(repo\.name\)/);
assert.doesNotMatch(page, /name: repo\.fullName/);

console.log('githubImportName.check: ok');

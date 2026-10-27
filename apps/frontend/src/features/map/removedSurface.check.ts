/**
 * Throwaway absence checks for the frontend cleanup. Delete in the test audit.
 * Run: npx --yes tsx src/features/map/removedSurface.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function readSourceFile(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

const applicationsApi = readSourceFile('./api/applicationsApi.ts');
const conflictsApi = readSourceFile('./api/overrideConflictsApi.ts');
const importPage = readSourceFile('./pages/GitHubImportPage.tsx');
const changeUi = readSourceFile('./utils/changeDetectionUi.ts');
const apiTypes = readSourceFile('../../types/api.ts');
const canvas = readSourceFile('./components/GraphCanvas.tsx');
const aboutPage = readSourceFile('../about/AboutPage.tsx');

assert.equal(applicationsApi.includes('fetchDetectionDocument'), false);
assert.equal(applicationsApi.includes('suggestModulesFromDocument'), false);
assert.equal(applicationsApi.includes('suggestConnectionsFromDocument'), false);
assert.equal(conflictsApi.includes('fetchOverrideConflictPendingCount'), false);
assert.equal(importPage.includes("get('github')"), false);
assert.equal(changeUi.includes('EDGE_ATTRIBUTE'), false);
assert.equal(apiTypes.includes('EDGE_ATTRIBUTE'), false);
assert.equal(canvas.includes('exportPivotElement'), false);
assert.equal(canvas.includes("from 'html-to-image'"), false);
assert.equal(aboutPage.includes('function AboutContactForm'), false);
assert.equal(aboutPage.includes('const MODES'), false);
assert.match(aboutPage, /FLOWRA_MODES/);
assert.match(aboutPage, /AboutContactForm/);

console.log('removedSurface.check: ok');

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
const rescan = readFileSync(new URL('../utils/rescanLinkedApplication.ts', import.meta.url), 'utf8');

assert.doesNotMatch(sources, /github-import-eyebrow/);
assert.match(sources, /Import sources/);
assert.match(sources, /GitHub/);
assert.match(sources, /Third party/);
assert.doesNotMatch(sources, /Scan with AI/);
assert.doesNotMatch(sources, /github-import-ai-btn/);
const importHandler = sources.slice(
  sources.indexOf('async function handleImportSelection'),
  sources.indexOf('async function handleScan'),
);
assert.ok(importHandler.length > 0, 'import handler sits before the scan handler');
assert.doesNotMatch(importHandler, /rescan/i, 'Import selection loads the application without the AI pass');
assert.match(sources, /async function handleScan\(repo: ListedRepo\)/);
assert.match(sources, /await rescanLinkedApplication\(application\.id\)/);
const card = sources.slice(sources.indexOf('className="github-import-row"'));
assert.match(card, /className="github-import-primary github-import-scan"/);
assert.match(card, /disabled=\{!imported \|\| isImporting \|\| isScanning\}/);
assert.match(card, /\{isScanning \? 'Scanning…' : 'Scan'\}/);
assert.match(css, /\.github-import-scan \{[^}]*flex-shrink: 0/);
assert.doesNotMatch(sources, /Import scans modules/);
assert.doesNotMatch(sources, /Suggest modules \(AI\)/);
assert.doesNotMatch(sources, /Suggest connections \(AI\)/);
assert.match(drawer, /Rescan/);
assert.match(drawer, /graph-drawer-rescan-icon/);
const actionRow = drawer.slice(drawer.indexOf('graph-details-action-row'));
const openAt = actionRow.indexOf('>Open<');
const editAt = actionRow.indexOf('>Edit<');
const rescanAt = actionRow.indexOf('Rescan');
assert.ok(openAt >= 0 && editAt > openAt && rescanAt > editAt);
assert.match(css, /\.graph-details-action-row \{[^}]*display:\s*flex/);
assert.match(drawer, /rescanLinkedApplication/);
assert.match(sources, /rescanLinkedApplication/);
assert.match(rescan, /generateFunctionalDocumentation/);
assert.match(rescan, /replaceExisting: true/);
assert.match(rescan, /suggestModulesFromGithub/);
assert.match(rescan, /suggestConnectionsFromGithub/);
assert.match(css, /graph-drawer-rescan-spin/);
assert.doesNotMatch(drawer, /Scan connections and attributes/);
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
assert.doesNotMatch(drawer, /Suggest modules \(AI\)/);
assert.doesNotMatch(drawer, /suggestModulesFromGithub/);
assert.match(drawer, /isGitHubLinkedApplication/);

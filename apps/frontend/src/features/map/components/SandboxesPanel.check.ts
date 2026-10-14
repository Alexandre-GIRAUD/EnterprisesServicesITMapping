/**
 * Runnable self-check for the open-sandbox row in My sandboxes.
 * Run: npx --yes tsx src/features/map/components/SandboxesPanel.check.ts
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SandboxesPanel } from './SandboxesPanel.tsx';
import type { SavedSandboxMeta } from '../utils/sandboxDocuments.ts';

const saved = {
  id: 'saved-1',
  name: 'Payroll',
  updatedAt: '2026-01-01T00:00:00.000Z',
  document: { id: 'saved-1', name: 'Payroll' },
} as SavedSandboxMeta;

const shared = {
  activeSandboxId: 'open-1',
  onFocusOpen: () => undefined,
  layoutMode: 'horizontal' as const,
  onLayoutModeChange: () => undefined,
  onNewSandbox: () => undefined,
  onSaveSandbox: () => undefined,
  onDuplicateSandbox: () => undefined,
  onCloseSandbox: () => undefined,
  savedSandboxes: [saved],
  sandboxFolders: [],
  onLoadSandbox: () => undefined,
  onDeleteSavedSandbox: () => undefined,
  onCreateSandboxFolder: () => undefined,
  onRenameSandboxFolder: () => undefined,
  onDeleteSandboxFolder: () => undefined,
  onMoveSandboxFolder: () => undefined,
  onRenameSavedSandbox: () => undefined,
  onMoveSavedSandbox: () => undefined,
  onShareSandbox: async () => undefined,
};

const html = renderToStaticMarkup(
  createElement(SandboxesPanel, {
    ...shared,
    openSandboxes: [{ id: 'open-1', name: 'Draft', dirty: true }],
  }),
);

const [beforeSaved, afterSaved] = html.split('>Saved<');
assert.ok(beforeSaved && afterSaved, 'Saved section missing');
assert.match(beforeSaved, /1 of 4/);
assert.match(beforeSaved, /1 of 4[\s\S]*?>New</);
assert.match(beforeSaved, /Draft[\s\S]*?>Save</);
assert.match(beforeSaved, /Draft[\s\S]*?>Duplicate</);
assert.match(beforeSaved, /Draft[\s\S]*?>Share</);
assert.match(beforeSaved, /Draft[\s\S]*?>Close</);
assert.match(html, />New folder</);
assert.doesNotMatch(html, />Payroll</);
assert.doesNotMatch(html, />Load</);
assert.doesNotMatch(afterSaved, />Share</);

const full = renderToStaticMarkup(
  createElement(SandboxesPanel, {
    ...shared,
    openSandboxes: [1, 2, 3, 4].map((index) => ({ id: `open-${index}`, name: `Board ${index}`, dirty: false })),
    activeSandboxId: 'open-1',
  }),
);
assert.match(full, /<button[^>]*disabled[^>]*>New<\/button>/);
assert.match(full, /4 of 4/);

console.log('SandboxesPanel.check: ok');

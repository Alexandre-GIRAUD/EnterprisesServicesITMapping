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
  onRenameOpenSandbox: () => undefined,
  onDuplicateSavedSandbox: () => undefined,
  onShareSandbox: async () => undefined,
};

const html = renderToStaticMarkup(
  createElement(SandboxesPanel, {
    ...shared,
    openSandboxes: [
      { id: 'open-1', name: 'Draft', dirty: true },
      { id: 'open-2', name: 'Other', dirty: false },
    ],
  }),
);

const [beforeSaved, savedAndAfter] = html.split('>Saved<');
assert.ok(beforeSaved && savedAndAfter, 'Saved section missing');
assert.match(html, /sandbox-manage-meta[\s\S]*2 of 4[\s\S]*aria-label="Horizontal"/);
assert.match(html, /sandbox-library-switch[\s\S]*?>New</);
assert.match(html, /aria-pressed="false"[^>]*>Saved</);
assert.match(html, /title="Double-click to rename"/);
assert.match(html, /aria-label="Actions for Draft"/);
assert.doesNotMatch(beforeSaved, />Save</);
assert.doesNotMatch(beforeSaved, />Duplicate</);
assert.doesNotMatch(beforeSaved, />Close</);
assert.doesNotMatch(html, />Payroll</);
assert.doesNotMatch(html, />Load</);

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

/**
 * Runnable self-check for local sandbox folders.
 * Run: npx --yes tsx src/features/map/utils/sandboxFolders.check.ts
 */
import assert from 'node:assert/strict';
import {
  canMoveSandbox,
  createdSandboxFolder,
  deletedSandboxFolder,
  loadSandboxFolders,
  renamedSandboxFolder,
  sandboxMenuEntries,
  type FiledSandbox,
  type SandboxFolder,
} from './sandboxFolders.ts';

const sandboxes: FiledSandbox[] = [{ id: 'pay', folderId: null, name: 'Payroll' }];

const created = createdSandboxFolder([], sandboxes, null, 'folder-1');
assert.equal(created?.name, 'New folder');
assert.equal(created?.parentId, null);

const folders: SandboxFolder[] = [created!];
assert.equal(createdSandboxFolder(folders, sandboxes, null, 'folder-2')?.name, 'New folder 2');
assert.equal(renamedSandboxFolder(folders, sandboxes, 'folder-1', 'Payroll'), null);
assert.equal(renamedSandboxFolder(folders, sandboxes, 'folder-1', 'Archive')?.[0]?.name, 'Archive');

const filed: FiledSandbox[] = [{ id: 'pay', folderId: 'folder-1', name: 'Payroll' }];
assert.equal(canMoveSandbox(folders, filed, 'pay', null), true);
assert.equal(canMoveSandbox(folders, filed, 'pay', 'folder-1'), false);

const nested: SandboxFolder[] = [
  { id: 'folder-1', parentId: null, name: 'Archive' },
  { id: 'child', parentId: 'folder-1', name: 'Old' },
];
const removed = deletedSandboxFolder(nested, filed, 'folder-1');
assert.deepEqual(removed.folders, []);
assert.deepEqual(removed.sandboxIds, ['pay']);

assert.deepEqual(loadSandboxFolders(null), []);
assert.deepEqual(loadSandboxFolders('nope'), []);
assert.deepEqual(loadSandboxFolders(JSON.stringify([{ id: 'a', name: 'A', parentId: null }, { id: 1 }])), [
  { id: 'a', name: 'A', parentId: null },
]);
assert.deepEqual(sandboxMenuEntries('empty'), ['New folder']);
assert.ok(sandboxMenuEntries('sandbox').includes('Move'));
assert.ok(!sandboxMenuEntries('sandbox').includes('Share'));

console.log('sandboxFolders.check: ok');

/**
 * Runnable self-check for local sandbox folders.
 * Run: npx --yes tsx src/features/map/utils/sandboxFolders.check.ts
 */
import assert from 'node:assert/strict';
import {
  canMoveSandboxTo,
  createSandboxFolderRecord,
  deleteSandboxFolderTree,
  listSandboxMenuEntries,
  loadSandboxFolders,
  moveSandboxFolderRecord,
  renameSandboxFolderRecord,
  renameSavedSandboxRecord,
  type FiledSandbox,
  type SandboxFolder,
  type SandboxLibrary,
} from './sandboxFolders.ts';

const sandboxes: FiledSandbox[] = [{ id: 'pay', folderId: null, name: 'Payroll' }];
const emptyLibrary: SandboxLibrary = { folders: [], sandboxes };

const created = createSandboxFolderRecord(emptyLibrary, null, 'folder-1');
assert.equal(created?.name, 'New folder');
assert.equal(created?.parentId, null);

const folders: SandboxFolder[] = [created!];
const rootLibrary: SandboxLibrary = { folders, sandboxes };
assert.equal(createSandboxFolderRecord(rootLibrary, null, 'folder-2')?.name, 'New folder 2');
assert.equal(renameSandboxFolderRecord(rootLibrary, 'folder-1', 'Payroll'), null);
assert.equal(renameSandboxFolderRecord(rootLibrary, 'folder-1', 'Archive')?.[0]?.name, 'Archive');

const filed: FiledSandbox[] = [{ id: 'pay', folderId: 'folder-1', name: 'Payroll' }];
const filedLibrary: SandboxLibrary = { folders, sandboxes: filed };
assert.equal(canMoveSandboxTo(filedLibrary, 'pay', null), true);
assert.equal(canMoveSandboxTo(filedLibrary, 'pay', 'folder-1'), false);
const conflictLibrary: SandboxLibrary = {
  folders,
  sandboxes: [
    { id: 'pay', folderId: 'folder-1', name: 'Payroll' },
    { id: 'ledger', folderId: 'folder-1', name: 'Ledger' },
  ],
};
assert.equal(renameSavedSandboxRecord(conflictLibrary, 'pay', 'Payroll draft'), 'Payroll draft');
assert.equal(renameSavedSandboxRecord(conflictLibrary, 'pay', 'Ledger'), null);
assert.equal(moveSandboxFolderRecord(rootLibrary, 'folder-1', null), null);
const moved = moveSandboxFolderRecord(
  { folders: [...folders, { id: 'folder-2', parentId: null, name: 'Other' }], sandboxes },
  'folder-1',
  'folder-2',
);
assert.equal(moved?.find((folder) => folder.id === 'folder-1')?.parentId, 'folder-2');

const nested: SandboxFolder[] = [
  { id: 'folder-1', parentId: null, name: 'Archive' },
  { id: 'child', parentId: 'folder-1', name: 'Old' },
];
const removed = deleteSandboxFolderTree({ folders: nested, sandboxes: filed }, 'folder-1');
assert.deepEqual(removed.folders, []);
assert.deepEqual(removed.sandboxIds, ['pay']);

assert.deepEqual(loadSandboxFolders(null), []);
assert.deepEqual(loadSandboxFolders('nope'), []);
assert.deepEqual(loadSandboxFolders(JSON.stringify([{ id: 'a', name: 'A', parentId: null }, { id: 1 }])), [
  { id: 'a', name: 'A', parentId: null },
]);
assert.deepEqual(listSandboxMenuEntries('empty'), ['New folder']);
assert.deepEqual(listSandboxMenuEntries('folder'), ['Rename', 'Move', 'Delete', 'New folder']);
assert.deepEqual(listSandboxMenuEntries('sandbox'), ['Rename', 'Duplicate', 'Share', 'Move', 'Delete']);

console.log('sandboxFolders.check: ok');

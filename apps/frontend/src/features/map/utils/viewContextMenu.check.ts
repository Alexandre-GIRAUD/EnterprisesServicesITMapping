/**
 * Runnable self-check for view context-menu rules.
 * Run: npx --yes tsx src/features/map/utils/viewContextMenu.check.ts
 */
import assert from 'node:assert/strict';
import {
  folderParentForNewFolder,
  savedViewActivation,
  viewMenuEntries,
} from './viewContextMenu.ts';

assert.deepEqual(viewMenuEntries('empty'), ['New folder']);
assert.deepEqual(viewMenuEntries('view'), ['Rename', 'Move', 'Share', 'Delete', 'New folder']);
assert.deepEqual(viewMenuEntries('folder'), ['Rename', 'Move', 'Share', 'Delete', 'New folder']);

assert.equal(folderParentForNewFolder('folder', 'folder-1', 'parent'), 'folder-1');
assert.equal(folderParentForNewFolder('view', 'view-1', 'parent'), 'parent');
assert.equal(folderParentForNewFolder('empty', null, 'parent'), 'parent');
assert.equal(folderParentForNewFolder('empty', null, null), null);

assert.equal(savedViewActivation('view', 'click'), 'select');
assert.equal(savedViewActivation('view', 'double'), 'apply');
assert.equal(savedViewActivation('folder', 'click'), 'enter');
assert.equal(savedViewActivation('folder', 'double'), 'enter');

console.log('viewContextMenu.check: ok');

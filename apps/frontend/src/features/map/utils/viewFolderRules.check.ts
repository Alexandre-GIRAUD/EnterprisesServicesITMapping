/**
 * Runnable self-check for view folder placement.
 * Run: npx --yes tsx src/features/map/utils/viewFolderRules.check.ts
 */
import assert from 'node:assert/strict';
import {
  canCreateIn,
  canMoveFolder,
  depth,
  nameTaken,
  nextFolderName,
  type FolderNode,
  type ViewName,
} from './viewFolderRules.ts';

const parent = 'parent';
const other = 'other';
const folders: FolderNode[] = [{ id: 'folder', parentId: parent, name: 'Payments' }];
const views: ViewName[] = [{ id: 'view', folderId: other, name: 'Payments' }];

assert.equal(nameTaken(folders, views, parent, 'payments', null, null), true);
assert.equal(nameTaken(folders, views, other, 'payments', null, 'view'), false);
assert.equal(nameTaken(folders, views, null, 'Payments', null, null), false);

const tree: FolderNode[] = [
  { id: 'root', parentId: null, name: 'A' },
  { id: 'child', parentId: 'root', name: 'B' },
];
assert.equal(canMoveFolder(tree, 'root', 'root'), false);
assert.equal(canMoveFolder(tree, 'root', 'child'), false);
assert.equal(canMoveFolder(tree, 'child', null), true);

const chain: FolderNode[] = [];
let previous: string | null = null;
for (let level = 1; level <= 8; level += 1) {
  const id = `L${level}`;
  chain.push({ id, parentId: previous, name: id });
  previous = id;
}
assert.equal(depth(chain, 'L8'), 8);
assert.equal(canCreateIn(chain, 'L8'), false);
assert.equal(canCreateIn(chain, 'L7'), true);
assert.equal(canMoveFolder(chain, 'L1', 'L8'), false);
assert.equal(nextFolderName(chain, [], null), 'New folder');

console.log('viewFolderRules.check: ok');

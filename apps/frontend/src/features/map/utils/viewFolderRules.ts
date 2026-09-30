export const MAX_FOLDER_DEPTH = 8;

export type FolderNode = {
  id: string;
  parentId: string | null;
  name: string;
};

export type ViewName = {
  id: string;
  folderId: string | null;
  name: string;
};

export function depth(folders: readonly FolderNode[], folderId: string): number {
  const parentById = new Map(folders.map((folder) => [folder.id, folder.parentId]));
  let depthCount = 0;
  let current: string | null = folderId;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    depthCount += 1;
    current = parentById.get(current) ?? null;
  }
  return depthCount;
}

export function canCreateIn(folders: readonly FolderNode[], parentId: string | null): boolean {
  if (parentId == null) return true;
  return depth(folders, parentId) < MAX_FOLDER_DEPTH;
}

export function canMoveFolder(
  folders: readonly FolderNode[],
  folderId: string,
  newParentId: string | null,
): boolean {
  if (folderId === newParentId) return false;
  if (newParentId != null && isUnder(folders, newParentId, folderId)) return false;
  const newDepth = newParentId == null ? 1 : depth(folders, newParentId) + 1;
  return newDepth + subtreeHeight(folders, folderId) <= MAX_FOLDER_DEPTH;
}

export function nameTaken(
  folders: readonly FolderNode[],
  views: readonly ViewName[],
  parentId: string | null,
  name: string,
  ignoreFolderId: string | null,
  ignoreViewId: string | null,
): boolean {
  const needle = name.trim().toLowerCase();
  for (const folder of folders) {
    if (folder.id === ignoreFolderId || !samePlace(folder.parentId, parentId)) continue;
    if (folder.name.trim().toLowerCase() === needle) return true;
  }
  for (const view of views) {
    if (view.id === ignoreViewId || !samePlace(view.folderId, parentId)) continue;
    if (view.name.trim().toLowerCase() === needle) return true;
  }
  return false;
}

export function descendantFolderIds(folders: readonly FolderNode[], folderId: string): string[] {
  const children = new Map<string, string[]>();
  for (const folder of folders) {
    if (!folder.parentId) continue;
    const list = children.get(folder.parentId) ?? [];
    list.push(folder.id);
    children.set(folder.parentId, list);
  }
  const descendants: string[] = [];
  const stack = [...(children.get(folderId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop();
    if (!id) continue;
    descendants.push(id);
    stack.push(...(children.get(id) ?? []));
  }
  return descendants;
}

export function nextFolderName(folders: readonly FolderNode[], views: readonly ViewName[], parentId: string | null): string {
  const base = 'New folder';
  if (!nameTaken(folders, views, parentId, base, null, null)) return base;
  let index = 2;
  while (nameTaken(folders, views, parentId, `${base} ${index}`, null, null)) {
    index += 1;
  }
  return `${base} ${index}`;
}

function isUnder(folders: readonly FolderNode[], nodeId: string, ancestorId: string): boolean {
  const parentById = new Map(folders.map((folder) => [folder.id, folder.parentId]));
  let current: string | null = nodeId;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    if (current === ancestorId) return true;
    seen.add(current);
    current = parentById.get(current) ?? null;
  }
  return false;
}

function subtreeHeight(folders: readonly FolderNode[], folderId: string): number {
  const children = new Map<string, string[]>();
  for (const folder of folders) {
    if (!folder.parentId) continue;
    const list = children.get(folder.parentId) ?? [];
    list.push(folder.id);
    children.set(folder.parentId, list);
  }
  return height(children, folderId);
}

function height(children: Map<string, string[]>, id: string): number {
  let max = 0;
  for (const child of children.get(id) ?? []) {
    max = Math.max(max, 1 + height(children, child));
  }
  return max;
}

function samePlace(left: string | null, right: string | null): boolean {
  return left === right;
}

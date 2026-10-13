import {
  canCreateIn,
  canMoveFolder,
  descendantFolderIds,
  nameTaken,
  nextFolderName,
  type FolderNode,
  type ViewName,
} from './viewFolderRules';

export type SandboxFolder = FolderNode;
export type FiledSandbox = ViewName;

export const SANDBOX_FOLDERS_STORAGE_KEY = 'flowra.sandbox.folders';
export const SANDBOX_MENU_RENAME = 'Rename';
export const SANDBOX_MENU_MOVE = 'Move';
export const SANDBOX_MENU_DELETE = 'Delete';
export const SANDBOX_MENU_NEW_FOLDER = 'New folder';

const ROW_MENU = [SANDBOX_MENU_RENAME, SANDBOX_MENU_MOVE, SANDBOX_MENU_DELETE, SANDBOX_MENU_NEW_FOLDER] as const;

export function sandboxMenuEntries(target: 'empty' | 'sandbox' | 'folder'): readonly string[] {
  if (target === 'empty') return [SANDBOX_MENU_NEW_FOLDER];
  return ROW_MENU;
}

export function loadSandboxFolders(raw: string | null): SandboxFolder[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSandboxFolder);
  } catch {
    return [];
  }
}

export function createdSandboxFolder(
  folders: readonly SandboxFolder[],
  sandboxes: readonly FiledSandbox[],
  parentId: string | null,
  newId: string,
): SandboxFolder | null {
  if (!canCreateIn(folders, parentId)) return null;
  return { id: newId, parentId, name: nextFolderName(folders, sandboxes, parentId) };
}

export function renamedSandboxFolder(
  folders: readonly SandboxFolder[],
  sandboxes: readonly FiledSandbox[],
  folderId: string,
  name: string,
): SandboxFolder[] | null {
  const folder = folders.find((entry) => entry.id === folderId);
  const trimmed = name.trim();
  if (!folder || !trimmed) return null;
  if (nameTaken(folders, sandboxes, folder.parentId, trimmed, folderId, null)) return null;
  return folders.map((entry) => (entry.id === folderId ? { ...entry, name: trimmed } : entry));
}

export function movedSandboxFolder(
  folders: readonly SandboxFolder[],
  sandboxes: readonly FiledSandbox[],
  folderId: string,
  parentId: string | null,
): SandboxFolder[] | null {
  const folder = folders.find((entry) => entry.id === folderId);
  if (!folder || folder.parentId === parentId) return null;
  if (!canMoveFolder(folders, folderId, parentId)) return null;
  if (nameTaken(folders, sandboxes, parentId, folder.name, folderId, null)) return null;
  return folders.map((entry) => (entry.id === folderId ? { ...entry, parentId } : entry));
}

export function renamedFiledSandbox(
  folders: readonly SandboxFolder[],
  sandboxes: readonly FiledSandbox[],
  sandboxId: string,
  name: string,
): string | null {
  const sandbox = sandboxes.find((entry) => entry.id === sandboxId);
  const trimmed = name.trim();
  if (!sandbox || !trimmed) return null;
  if (nameTaken(folders, sandboxes, sandbox.folderId, trimmed, null, sandboxId)) return null;
  return trimmed;
}

export function canMoveSandbox(
  folders: readonly SandboxFolder[],
  sandboxes: readonly FiledSandbox[],
  sandboxId: string,
  folderId: string | null,
): boolean {
  const sandbox = sandboxes.find((entry) => entry.id === sandboxId);
  if (!sandbox || sandbox.folderId === folderId) return false;
  return !nameTaken(folders, sandboxes, folderId, sandbox.name, null, sandboxId);
}

export function deletedSandboxFolder(
  folders: readonly SandboxFolder[],
  sandboxes: readonly FiledSandbox[],
  folderId: string,
): { folders: SandboxFolder[]; sandboxIds: string[] } {
  const gone = new Set([folderId, ...descendantFolderIds(folders, folderId)]);
  return {
    folders: folders.filter((folder) => !gone.has(folder.id)),
    sandboxIds: sandboxes
      .filter((sandbox) => sandbox.folderId != null && gone.has(sandbox.folderId))
      .map((sandbox) => sandbox.id),
  };
}

export function sandboxMoveDestinations(
  kind: 'sandbox' | 'folder',
  id: string,
  folders: readonly SandboxFolder[],
  sandboxes: readonly FiledSandbox[],
): { id: string; label: string }[] {
  const options: { id: string; label: string }[] = [];
  if (canPlace(kind, id, null, folders, sandboxes)) options.push({ id: 'root', label: 'Saved' });
  const ordered = [...folders].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
  for (const folder of ordered) {
    if (!canPlace(kind, id, folder.id, folders, sandboxes)) continue;
    options.push({ id: folder.id, label: folderPathLabel(folders, folder.id) });
  }
  return options;
}

function canPlace(
  kind: 'sandbox' | 'folder',
  id: string,
  parentId: string | null,
  folders: readonly SandboxFolder[],
  sandboxes: readonly FiledSandbox[],
): boolean {
  if (kind === 'folder') return movedSandboxFolder(folders, sandboxes, id, parentId) != null;
  return canMoveSandbox(folders, sandboxes, id, parentId);
}

function folderPathLabel(folders: readonly SandboxFolder[], folderId: string): string {
  const names: string[] = [];
  let current = folders.find((folder) => folder.id === folderId);
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    names.push(current.name);
    const parentId = current.parentId;
    current = parentId ? folders.find((folder) => folder.id === parentId) : undefined;
  }
  return names.reverse().join(' / ');
}

function isSandboxFolder(value: unknown): value is SandboxFolder {
  if (!value || typeof value !== 'object') return false;
  const folder = value as SandboxFolder;
  const parentIsValid = folder.parentId === null || typeof folder.parentId === 'string';
  return typeof folder.id === 'string' && typeof folder.name === 'string' && parentIsValid;
}

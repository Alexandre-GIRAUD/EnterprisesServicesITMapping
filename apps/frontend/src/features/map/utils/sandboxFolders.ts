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

export type SandboxLibrary = {
  folders: readonly SandboxFolder[];
  sandboxes: readonly FiledSandbox[];
};

export const SANDBOX_FOLDERS_STORAGE_KEY = 'flowra.sandbox.folders';
export const SANDBOX_ROOT_DESTINATION = 'root';
export const SANDBOX_MENU_RENAME = 'Rename';
export const SANDBOX_MENU_MOVE = 'Move';
export const SANDBOX_MENU_DELETE = 'Delete';
export const SANDBOX_MENU_NEW_FOLDER = 'New folder';

const ROW_MENU = [SANDBOX_MENU_RENAME, SANDBOX_MENU_MOVE, SANDBOX_MENU_DELETE, SANDBOX_MENU_NEW_FOLDER] as const;
const NAME_SORT: Intl.CollatorOptions = { sensitivity: 'base' };
const PATH_SEPARATOR = ' / ';

export function listSandboxMenuEntries(target: 'empty' | 'sandbox' | 'folder'): readonly string[] {
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

export function createSandboxFolderRecord(
  library: SandboxLibrary,
  parentId: string | null,
  newId: string,
): SandboxFolder | null {
  if (!canCreateIn(library.folders, parentId)) return null;
  return { id: newId, parentId, name: nextFolderName(library.folders, library.sandboxes, parentId) };
}

export function renameSandboxFolderRecord(
  library: SandboxLibrary,
  folderId: string,
  name: string,
): SandboxFolder[] | null {
  const folder = library.folders.find((entry) => entry.id === folderId);
  const trimmed = name.trim();
  if (!folder || !trimmed) return null;
  if (nameTaken(library.folders, library.sandboxes, folder.parentId, trimmed, folderId, null)) return null;
  return library.folders.map((entry) => (entry.id === folderId ? { ...entry, name: trimmed } : entry));
}

export function moveSandboxFolderRecord(
  library: SandboxLibrary,
  folderId: string,
  parentId: string | null,
): SandboxFolder[] | null {
  const folder = library.folders.find((entry) => entry.id === folderId);
  if (!folder || folder.parentId === parentId) return null;
  if (!canMoveFolder(library.folders, folderId, parentId)) return null;
  if (nameTaken(library.folders, library.sandboxes, parentId, folder.name, folderId, null)) return null;
  return library.folders.map((entry) => (entry.id === folderId ? { ...entry, parentId } : entry));
}

export function renameSavedSandboxRecord(library: SandboxLibrary, sandboxId: string, name: string): string | null {
  const sandbox = library.sandboxes.find((entry) => entry.id === sandboxId);
  const trimmed = name.trim();
  if (!sandbox || !trimmed) return null;
  if (nameTaken(library.folders, library.sandboxes, sandbox.folderId, trimmed, null, sandboxId)) return null;
  return trimmed;
}

export function canMoveSandboxTo(library: SandboxLibrary, sandboxId: string, folderId: string | null): boolean {
  const sandbox = library.sandboxes.find((entry) => entry.id === sandboxId);
  if (!sandbox || sandbox.folderId === folderId) return false;
  return !nameTaken(library.folders, library.sandboxes, folderId, sandbox.name, null, sandboxId);
}

/** Same rule as a view folder: the folder and everything inside it go away. */
export function deleteSandboxFolderTree(
  library: SandboxLibrary,
  folderId: string,
): { folders: SandboxFolder[]; sandboxIds: string[] } {
  const gone = new Set([folderId, ...descendantFolderIds(library.folders, folderId)]);
  return {
    folders: library.folders.filter((folder) => !gone.has(folder.id)),
    sandboxIds: library.sandboxes
      .filter((sandbox) => sandbox.folderId != null && gone.has(sandbox.folderId))
      .map((sandbox) => sandbox.id),
  };
}

export function listSandboxMoveDestinations(
  library: SandboxLibrary,
  item: { kind: 'sandbox' | 'folder'; id: string },
): { id: string; label: string }[] {
  const options: { id: string; label: string }[] = [];
  if (canPlace(library, item, null)) options.push({ id: SANDBOX_ROOT_DESTINATION, label: 'Saved' });
  const ordered = [...library.folders].sort((left, right) => left.name.localeCompare(right.name, undefined, NAME_SORT));
  for (const folder of ordered) {
    if (!canPlace(library, item, folder.id)) continue;
    options.push({ id: folder.id, label: folderPathLabel(library.folders, folder.id) });
  }
  return options;
}

function canPlace(
  library: SandboxLibrary,
  item: { kind: 'sandbox' | 'folder'; id: string },
  parentId: string | null,
): boolean {
  if (item.kind === 'folder') return moveSandboxFolderRecord(library, item.id, parentId) != null;
  return canMoveSandboxTo(library, item.id, parentId);
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
  return names.reverse().join(PATH_SEPARATOR);
}

function isSandboxFolder(value: unknown): value is SandboxFolder {
  if (!value || typeof value !== 'object') return false;
  const folder = value as SandboxFolder;
  const parentIsValid = folder.parentId === null || typeof folder.parentId === 'string';
  return typeof folder.id === 'string' && typeof folder.name === 'string' && parentIsValid;
}

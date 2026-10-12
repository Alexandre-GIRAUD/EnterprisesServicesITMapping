export type ViewMenuTarget = 'empty' | 'view' | 'folder';

export const VIEW_MENU_RENAME = 'Rename';
export const VIEW_MENU_MOVE = 'Move';
export const VIEW_MENU_SHARE = 'Share';
export const VIEW_MENU_DELETE = 'Delete';
export const VIEW_MENU_NEW_FOLDER = 'New folder';

const ROW_MENU = [
  VIEW_MENU_RENAME,
  VIEW_MENU_MOVE,
  VIEW_MENU_SHARE,
  VIEW_MENU_DELETE,
  VIEW_MENU_NEW_FOLDER,
] as const;

export function viewMenuEntries(target: ViewMenuTarget): readonly string[] {
  if (target === 'empty') return [VIEW_MENU_NEW_FOLDER];
  return ROW_MENU;
}

/** A folder click creates inside that folder. A view or empty area uses the folder that is open. */
export function folderParentForNewFolder(
  target: ViewMenuTarget,
  targetId: string | null,
  currentFolderId: string | null,
): string | null {
  if (target === 'folder' && targetId) return targetId;
  return currentFolderId;
}

/** A saved view opens on a single click. A folder is entered. */
export function savedViewActivation(kind: 'view' | 'folder'): 'apply' | 'enter' {
  return kind === 'view' ? 'apply' : 'enter';
}

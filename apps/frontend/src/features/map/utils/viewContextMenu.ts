export type ViewMenuTarget = 'empty' | 'view' | 'folder';

const ROW_MENU = ['Rename', 'Move', 'Share', 'Delete', 'New folder'] as const;

export function viewMenuEntries(target: ViewMenuTarget): readonly string[] {
  if (target === 'empty') return ['New folder'];
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

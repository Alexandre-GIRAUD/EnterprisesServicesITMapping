export const SIDEBAR_COLLAPSED_STORAGE_KEY = 'flowra-sidebar-collapsed';

export function storedSidebarCollapsed(stored: string | null): boolean {
  return stored === 'true';
}

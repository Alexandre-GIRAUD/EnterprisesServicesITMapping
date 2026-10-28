import type { NavigationIconName } from './NavigationIcon';

/** Chatbot leads the menu. Set false to place it last without nesting Cartography under it. */
export const CHATBOT_IS_PRIMARY = true;

export type SidebarProfileAction = {
  id: string;
  label: string;
  icon?: NavigationIconName;
  onSelect: () => void;
};

export type SidebarEntry = {
  label: string;
  to: string;
  icon: NavigationIconName;
  isEnd?: boolean;
  badge?: string;
  showSeparator?: boolean;
};

const CARTOGRAPHY_AND_REST: readonly SidebarEntry[] = [
  { label: 'Cartography', to: '/map', icon: 'cartography', isEnd: true },
  { label: 'Data Model', to: '/data-model', icon: 'dataModel' },
  { label: 'Sources', to: '/map/import-github', icon: 'sources' },
  { label: 'Changes', to: '/admin/changes', icon: 'changes' },
];

export function mainNavigationEntries(chatbotIsPrimary = CHATBOT_IS_PRIMARY): SidebarEntry[] {
  const chatbot: SidebarEntry = {
    label: 'Chatbot',
    to: '/chat',
    icon: 'chat',
    badge: chatbotIsPrimary ? 'IA' : undefined,
    showSeparator: chatbotIsPrimary,
  };
  if (chatbotIsPrimary) return [chatbot, ...CARTOGRAPHY_AND_REST];
  return [...CARTOGRAPHY_AND_REST, chatbot];
}

/** Open the cartography list only when the user arrives on that page. */
export function shouldOpenWorkspace(wasOnCartography: boolean, isOnCartography: boolean): boolean {
  return isOnCartography && !wasOnCartography;
}

export function profileInitial(username: string): string {
  const firstCharacter = Array.from(username.trim())[0];
  return firstCharacter ? firstCharacter.toUpperCase() : '?';
}

export function profileRoleLabel(roles: readonly string[]): string | null {
  const labels = roles.map(formatRole).filter((label) => label.length > 0);
  if (labels.length === 0) return null;
  return labels.join(' · ');
}

function formatRole(role: string): string {
  const trimmed = role.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

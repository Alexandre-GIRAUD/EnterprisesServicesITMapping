import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import './sidebarTokens.css';
import { NavigationIcon } from './NavigationIcon';
import { profileInitial, profileRoleLabel, type SidebarProfileAction } from './sidebarModel';
import { nextMenuIndex } from './sidebarRoving';

const NO_ACTIONS: readonly SidebarProfileAction[] = [];

type SidebarProfileProps = {
  username: string;
  roles: readonly string[];
  onSignOut: () => void;
  actions?: readonly SidebarProfileAction[];
};

export function SidebarProfile({ username, roles, onSignOut, actions = NO_ACTIONS }: SidebarProfileProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const closeMenu = useCallback((restoreFocus: boolean) => {
    setIsOpen(false);
    if (restoreFocus) triggerRef.current?.focus({ focusVisible: true } as FocusOptions);
  }, []);
  useProfileMenuDismiss(isOpen, rootRef, closeMenu);
  useEffect(() => {
    if (!isOpen) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ focusVisible: true } as FocusOptions);
  }, [isOpen]);

  const roleLabel = profileRoleLabel(roles);
  return (
    <div className="sidebar-profile" ref={rootRef}>
      <ProfileTrigger
        username={username}
        roleLabel={roleLabel}
        isOpen={isOpen}
        menuId={menuId}
        triggerRef={triggerRef}
        onToggle={() => setIsOpen((open) => !open)}
      />
      {isOpen ? (
        <ProfileMenu
          menuId={menuId}
          menuRef={menuRef}
          actions={actions}
          onKeyDown={(event) => onProfileMenuKeyDown(event, () => closeMenu(true))}
          onSelect={(action) => {
            closeMenu(false);
            action();
          }}
          onSignOut={() => {
            closeMenu(false);
            onSignOut();
          }}
        />
      ) : null}
    </div>
  );
}

function ProfileTrigger({
  username,
  roleLabel,
  isOpen,
  menuId,
  triggerRef,
  onToggle,
}: {
  username: string;
  roleLabel: string | null;
  isOpen: boolean;
  menuId: string;
  triggerRef: { current: HTMLButtonElement | null };
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      ref={triggerRef}
      className="sidebar-profile-trigger"
      data-sidebar-item=""
      aria-haspopup="menu"
      aria-expanded={isOpen}
      aria-controls={menuId}
      onClick={onToggle}
    >
      <span className="sidebar-avatar" aria-hidden="true">
        {profileInitial(username)}
      </span>
      <span className="sidebar-profile-text">
        <span className="sidebar-profile-name" title={username}>
          {username}
        </span>
        {roleLabel ? (
          <span className="sidebar-profile-role" title={roleLabel}>
            {roleLabel}
          </span>
        ) : null}
      </span>
      <span className="sidebar-profile-chevron" aria-hidden="true">
        <NavigationIcon name="chevronDown" />
      </span>
    </button>
  );
}

function ProfileMenu({
  menuId,
  menuRef,
  actions,
  onKeyDown,
  onSelect,
  onSignOut,
}: {
  menuId: string;
  menuRef: { current: HTMLDivElement | null };
  actions: readonly SidebarProfileAction[];
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onSelect: (action: () => void) => void;
  onSignOut: () => void;
}) {
  return (
    <div
      id={menuId}
      ref={menuRef}
      className="sidebar-profile-menu"
      role="menu"
      data-sidebar-menu=""
      onKeyDown={onKeyDown}
    >
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          role="menuitem"
          className="sidebar-profile-menu-item"
          onClick={() => onSelect(action.onSelect)}
        >
          {action.icon ? <NavigationIcon name={action.icon} /> : null}
          {action.label}
        </button>
      ))}
      {actions.length > 0 ? <div className="sidebar-profile-separator" role="separator" /> : null}
      <button type="button" role="menuitem" className="sidebar-profile-menu-item" onClick={onSignOut}>
        <NavigationIcon name="logOut" />
        Sign out
      </button>
    </div>
  );
}

function onProfileMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>, closeMenu: () => void) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    closeMenu();
    return;
  }
  const menuKey = event.key === 'Tab' && event.shiftKey ? 'Shift+Tab' : event.key;
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')];
  const currentIndex = items.indexOf(document.activeElement as HTMLElement);
  const nextIndex = nextMenuIndex(currentIndex, items.length, menuKey);
  if (nextIndex == null) return;
  event.preventDefault();
  event.stopPropagation();
  items[nextIndex]?.focus({ focusVisible: true } as FocusOptions);
}

function useProfileMenuDismiss(
  isOpen: boolean,
  rootRef: { current: HTMLElement | null },
  closeMenu: (restoreFocus: boolean) => void,
) {
  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      closeMenu(false);
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      closeMenu(true);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [isOpen, rootRef, closeMenu]);
}

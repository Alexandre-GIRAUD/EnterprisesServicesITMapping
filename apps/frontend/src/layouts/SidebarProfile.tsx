import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import './sidebarTokens.css';
import { NavigationIcon } from './NavigationIcon';
import { profileInitial, profileRoleLabel, type SidebarProfileAction } from './sidebarModel';
import { primeSidebarTabStops } from './sidebarRoving';

const NO_ACTIONS: readonly SidebarProfileAction[] = [];

type SidebarProfileProps = {
  username: string;
  roles: readonly string[];
  /** Shown next to the role so a cloud user can tell which workspace they are in. */
  workspaceName?: string;
  onSignOut: () => void;
  actions?: readonly SidebarProfileAction[];
};

export function SidebarProfile({
  username,
  roles,
  workspaceName,
  onSignOut,
  actions = NO_ACTIONS,
}: SidebarProfileProps) {
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
  useLayoutEffect(() => {
    const sidebar = rootRef.current?.closest('aside');
    if (sidebar instanceof HTMLElement) primeSidebarTabStops(sidebar);
  }, [isOpen]);

  const detailLabel = [profileRoleLabel(roles), workspaceName].filter(Boolean).join(' · ') || null;
  return (
    <div className="sidebar-profile" ref={rootRef}>
      <ProfileTrigger
        username={username}
        detailLabel={detailLabel}
        isOpen={isOpen}
        menuId={menuId}
        triggerRef={triggerRef}
        onToggle={() => setIsOpen((open) => !open)}
      />
      {isOpen ? (
        <div
          id={menuId}
          ref={menuRef}
          className="sidebar-subnav"
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            closeMenu(true);
          }}
        >
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              className="sidebar-subitem"
              data-sidebar-item=""
              onClick={() => {
                closeMenu(false);
                action.onSelect();
              }}
            >
              {action.icon ? <NavigationIcon name={action.icon} /> : null}
              {action.label}
            </button>
          ))}
          {actions.length > 0 ? <div className="sidebar-profile-separator" role="separator" /> : null}
          <button
            type="button"
            className="sidebar-subitem"
            data-sidebar-item=""
            onClick={() => {
              closeMenu(false);
              onSignOut();
            }}
          >
            <NavigationIcon name="logOut" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ProfileTrigger({
  username,
  detailLabel,
  isOpen,
  menuId,
  triggerRef,
  onToggle,
}: {
  username: string;
  detailLabel: string | null;
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
        {detailLabel ? (
          <span className="sidebar-profile-role" title={detailLabel}>
            {detailLabel}
          </span>
        ) : null}
      </span>
      <span className="sidebar-profile-chevron" aria-hidden="true">
        <NavigationIcon name="chevronDown" />
      </span>
    </button>
  );
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

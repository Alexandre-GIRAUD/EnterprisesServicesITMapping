import type { MouseEvent, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import './sidebarTokens.css';

type SidebarNavItemProps = {
  label: string;
  icon: ReactNode;
  to?: string;
  end?: boolean;
  forceActive?: boolean;
  badge?: string;
  showSeparator?: boolean;
  isActive?: boolean;
  /** When set, replaces the route match. False keeps the item idle on the current page. */
  isCurrent?: boolean;
  trailing?: ReactNode;
  onClick?: (event: MouseEvent) => void;
  ariaExpanded?: boolean;
  ariaControls?: string;
  ariaLabel?: string;
};

function itemClassName(isActive: boolean, showSeparator: boolean): string {
  const classNames = ['sidebar-nav-item'];
  if (isActive) classNames.push('is-active');
  if (showSeparator) classNames.push('has-separator');
  return classNames.join(' ');
}

function ItemBody({
  icon,
  label,
  badge,
  trailing,
}: {
  icon: ReactNode;
  label: string;
  badge?: string;
  trailing?: ReactNode;
}) {
  return (
    <>
      <span className="sidebar-nav-item-icon">{icon}</span>
      <span className="sidebar-nav-item-label">{label}</span>
      {trailing}
      {badge ? <span className="sidebar-ia-badge">{badge}</span> : null}
    </>
  );
}

export function SidebarNavItem({
  label,
  icon,
  to,
  end = false,
  forceActive = false,
  badge,
  showSeparator = false,
  isActive = false,
  isCurrent,
  trailing,
  onClick,
  ariaExpanded,
  ariaControls,
  ariaLabel,
}: SidebarNavItemProps) {
  const body = <ItemBody icon={icon} label={label} badge={badge} trailing={trailing} />;
  if (to) {
    return (
      <NavLink
        to={to}
        end={end}
        data-sidebar-item=""
        aria-label={ariaLabel}
        onClick={onClick}
        className={({ isActive: routeIsActive }) =>
          itemClassName(isCurrent ?? (routeIsActive || forceActive), showSeparator)
        }
      >
        {body}
      </NavLink>
    );
  }
  return (
    <button
      type="button"
      data-sidebar-item=""
      className={itemClassName(isActive, showSeparator)}
      onClick={onClick}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      aria-label={ariaLabel}
    >
      {body}
    </button>
  );
}

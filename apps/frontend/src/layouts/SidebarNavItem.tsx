import type { ReactNode } from 'react';
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
  onClick?: () => void;
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

function ItemBody({ icon, label, badge }: { icon: ReactNode; label: string; badge?: string }) {
  return (
    <>
      <span className="sidebar-nav-item-icon">{icon}</span>
      <span className="sidebar-nav-item-label">{label}</span>
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
  onClick,
  ariaExpanded,
  ariaControls,
  ariaLabel,
}: SidebarNavItemProps) {
  const body = <ItemBody icon={icon} label={label} badge={badge} />;
  if (to) {
    return (
      <NavLink
        to={to}
        end={end}
        data-sidebar-item=""
        aria-label={ariaLabel}
        className={({ isActive: routeIsActive }) => itemClassName(routeIsActive || forceActive, showSeparator)}
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

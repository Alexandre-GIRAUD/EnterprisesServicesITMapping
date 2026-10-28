import type { ReactNode } from 'react';
import './sidebarTokens.css';

type SidebarSubItemProps = {
  id: string;
  label: string;
  tone: 'production' | 'sandbox' | 'views';
  isActive: boolean;
  onClick: () => void;
  trailing?: ReactNode;
};

export function SidebarSubItem({ id, label, tone, isActive, onClick, trailing }: SidebarSubItemProps) {
  const className = `sidebar-subitem sidebar-subitem--${tone}${isActive ? ' is-active' : ''}`;
  return (
    <button
      type="button"
      role="tab"
      id={id}
      data-sidebar-item=""
      className={className}
      aria-selected={isActive}
      onClick={onClick}
    >
      <span>{label}</span>
      {trailing}
    </button>
  );
}

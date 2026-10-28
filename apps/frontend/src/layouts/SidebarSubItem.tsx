import type { ReactNode } from 'react';
import './sidebarTokens.css';

type SidebarSubItemProps = {
  id: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
  trailing?: ReactNode;
};

export function SidebarSubItem({ id, label, isActive, onClick, trailing }: SidebarSubItemProps) {
  const className = isActive ? 'sidebar-subitem is-active' : 'sidebar-subitem';
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

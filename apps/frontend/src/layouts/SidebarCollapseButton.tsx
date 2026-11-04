import { NavigationIcon } from './NavigationIcon';

type SidebarCollapseButtonProps = {
  isCollapsed: boolean;
  onToggle: () => void;
};

export function SidebarCollapseButton({ isCollapsed, onToggle }: SidebarCollapseButtonProps) {
  return (
    <button
      type="button"
      className="sidebar-collapse"
      aria-expanded={!isCollapsed}
      aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      onClick={onToggle}
    >
      <NavigationIcon name="chevronDown" />
    </button>
  );
}

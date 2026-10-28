import './sidebarTokens.css';
import type { ColorTheme } from './colorTheme';
import { NavigationIcon } from './NavigationIcon';

const THEME_TOGGLE_LABEL = 'Changer de thème';

type ThemeToggleProps = {
  theme: ColorTheme;
  onToggle: () => void;
};

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      className="sidebar-theme-toggle"
      data-sidebar-item=""
      aria-label={THEME_TOGGLE_LABEL}
      aria-pressed={isDark}
      onClick={onToggle}
    >
      <NavigationIcon name={isDark ? 'moon' : 'sun'} />
      <span className="sidebar-tooltip" role="tooltip" aria-hidden="true">
        {THEME_TOGGLE_LABEL}
      </span>
    </button>
  );
}

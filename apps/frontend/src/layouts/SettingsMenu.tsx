import { NavLink, useLocation } from 'react-router-dom';
import { NavigationIcon } from './NavigationIcon';
import { settingsMenuItems } from './settingsEntries';

const SETTINGS_PATH = '/settings';

export function SettingsMenu() {
  const { pathname } = useLocation();
  const isOnSettingsDestination = settingsMenuItems(true).some(
    (item) => pathname === item.to || pathname.startsWith(`${item.to}/`),
  );

  return (
    <NavLink
      to={SETTINGS_PATH}
      className={({ isActive }) =>
        `layout-sidebar-link${isActive || isOnSettingsDestination ? ' is-active' : ''}`
      }
    >
      <NavigationIcon name="settings" />
      <span>Settings</span>
    </NavLink>
  );
}

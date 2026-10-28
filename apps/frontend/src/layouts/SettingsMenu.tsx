import { useLocation } from 'react-router-dom';
import { NavigationIcon } from './NavigationIcon';
import { SidebarNavItem } from './SidebarNavItem';
import { settingsMenuItems } from './settingsEntries';

const SETTINGS_PATH = '/settings';

export function SettingsMenu() {
  const { pathname } = useLocation();
  const isOnSettingsDestination = settingsMenuItems(true).some(
    (item) => pathname === item.to || pathname.startsWith(`${item.to}/`),
  );

  return (
    <SidebarNavItem
      label="Settings"
      to={SETTINGS_PATH}
      forceActive={isOnSettingsDestination}
      icon={<NavigationIcon name="settings" />}
    />
  );
}

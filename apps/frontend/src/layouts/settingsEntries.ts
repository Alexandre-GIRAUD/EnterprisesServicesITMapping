export type SettingsMenuItem = {
  label: string;
  to: string;
};

/** Settings page entries. The admin entry is only present for an admin account. */
export function settingsMenuItems(isAdmin: boolean): SettingsMenuItem[] {
  if (!isAdmin) {
    return [];
  }
  return [{ label: 'Admin', to: '/admin/users' }];
}

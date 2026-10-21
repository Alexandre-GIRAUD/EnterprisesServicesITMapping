import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import flowraLogo from '@/assets/flowra.svg';
import { useAuth } from '@/features/auth/context/AuthContext';
import { GraphSnapshotsProvider } from '@/features/map/context/GraphSnapshotsContext';
import type { MapLocationState } from '@/features/map/utils/mapNavigation';
import { COLOR_THEME_STORAGE_KEY, storedColorTheme, toggledColorTheme, type ColorTheme } from './colorTheme';
import { NavigationIcon, type NavigationIconName } from './NavigationIcon';
import { SettingsMenu } from './SettingsMenu';
import { ThemeModeButton } from './ThemeModeButton';

type NavigationItem = {
  label: string;
  to: string;
  icon: NavigationIconName;
  isEnd?: boolean;
  state?: MapLocationState;
};

const NAVIGATION_ITEMS: NavigationItem[] = [
  { label: 'Cartography', to: '/map', icon: 'cartography', isEnd: true, state: { graphMode: 'normal' } },
  { label: 'Data Model', to: '/data-model', icon: 'dataModel' },
  { label: 'Sources', to: '/map/import-github', icon: 'sources' },
  { label: 'Changes', to: '/admin/changes', icon: 'changes' },
];

function navigationLinkClassName({ isActive }: { isActive: boolean }) {
  return `layout-sidebar-link${isActive ? ' is-active' : ''}`;
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const roleLabel = user?.roles?.length ? user.roles.join(' · ') : null;
  const [theme, setTheme] = useState<ColorTheme>(() =>
    storedColorTheme(localStorage.getItem(COLOR_THEME_STORAGE_KEY)),
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(COLOR_THEME_STORAGE_KEY, theme);
  }, [theme]);

  return (
    <GraphSnapshotsProvider>
      <div className="layout">
        <aside className="layout-sidebar">
          <Link to="/about" className="layout-brand layout-brand-link">
            <img src={flowraLogo} alt="" className="layout-brand-logo" aria-hidden />
            <h1>Flowra</h1>
          </Link>
          {user ? (
            <>
              <nav className="layout-sidebar-nav" aria-label="Main navigation">
                {NAVIGATION_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.isEnd}
                    state={item.state}
                    className={navigationLinkClassName}
                  >
                    <NavigationIcon name={item.icon} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
                <SettingsMenu />
              </nav>
              <div className="layout-sidebar-footer">
                <span className="layout-sidebar-user-meta">
                  <span className="layout-sidebar-user" title={user.username}>
                    {user.username}
                  </span>
                  {roleLabel ? (
                    <span className="layout-sidebar-role" title={roleLabel}>
                      {roleLabel}
                    </span>
                  ) : null}
                  <ThemeModeButton theme={theme} onToggle={() => setTheme((current) => toggledColorTheme(current))} />
                </span>
                <button
                  type="button"
                  className="layout-sidebar-signout"
                  onClick={() => {
                    logout();
                    navigate('/login', { replace: true });
                  }}
                >
                  Sign out
                </button>
              </div>
            </>
          ) : null}
        </aside>
        <main className="layout-main">
          <Outlet />
        </main>
      </div>
    </GraphSnapshotsProvider>
  );
}

import { Fragment, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useMatch, useNavigate } from 'react-router-dom';
import flowraLogo from '@/assets/flowra.svg';
import { useAuth } from '@/features/auth/context/AuthContext';
import type { GraphMode } from '@/features/map/components/GraphModeTabs';
import { GraphSnapshotsProvider } from '@/features/map/context/GraphSnapshotsContext';
import { WorkspaceModeProvider, useWorkspaceMode } from '@/features/map/context/WorkspaceModeContext';
import type { MapLocationState } from '@/features/map/utils/mapNavigation';
import { COLOR_THEME_STORAGE_KEY, storedColorTheme, toggledColorTheme, type ColorTheme } from './colorTheme';
import { NavigationIcon, type NavigationIconName } from './NavigationIcon';
import { HelpMenu } from './HelpMenu';
import { SettingsMenu } from './SettingsMenu';
import { ThemeModeButton } from './ThemeModeButton';
import { WorkspaceModeNav } from './WorkspaceModeNav';

type NavigationItem = {
  label: string;
  to: string;
  icon: NavigationIconName;
  isEnd?: boolean;
  state?: MapLocationState;
};

const NAVIGATION_ITEMS: NavigationItem[] = [
  { label: 'Cartography', to: '/map', icon: 'cartography', isEnd: true },
  { label: 'Data Model', to: '/data-model', icon: 'dataModel' },
  { label: 'Sources', to: '/map/import-github', icon: 'sources' },
  { label: 'Changes', to: '/admin/changes', icon: 'changes' },
];

function navigationLinkClassName({ isActive }: { isActive: boolean }) {
  return `layout-sidebar-link${isActive ? ' is-active' : ''}`;
}

export function Layout() {
  return (
    <GraphSnapshotsProvider>
      <WorkspaceModeProvider>
        <LayoutShell />
      </WorkspaceModeProvider>
    </GraphSnapshotsProvider>
  );
}

function LayoutShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const onCartography = useMatch({ path: '/map', end: true });
  const { mode, sandboxDirty } = useWorkspaceMode();
  const roleLabel = user?.roles?.length ? user.roles.join(' · ') : null;
  const [theme, setTheme] = useState<ColorTheme>(() =>
    storedColorTheme(localStorage.getItem(COLOR_THEME_STORAGE_KEY)),
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(COLOR_THEME_STORAGE_KEY, theme);
  }, [theme]);

  function openWorkspaceMode(next: GraphMode) {
    if (onCartography && mode === next) return;
    navigate('/map', { state: { graphMode: next } satisfies MapLocationState });
  }

  return (
      <div className="layout">
        <aside className="layout-sidebar">
          <div className="layout-brand-row">
            <Link to="/about" className="layout-brand layout-brand-link">
              <img src={flowraLogo} alt="" className="layout-brand-logo" aria-hidden />
              <h1>Flowra</h1>
            </Link>
          </div>
          {user ? (
            <>
              <nav className="layout-sidebar-nav" aria-label="Main navigation">
                {NAVIGATION_ITEMS.map((item) => (
                  <Fragment key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.isEnd}
                      state={item.state}
                      className={navigationLinkClassName}
                    >
                      <NavigationIcon name={item.icon} />
                      <span>{item.label}</span>
                    </NavLink>
                    {item.to === '/map' ? (
                      <WorkspaceModeNav
                        mode={onCartography ? mode : null}
                        sandboxDirty={Boolean(onCartography && sandboxDirty)}
                        onModeChange={openWorkspaceMode}
                      />
                    ) : null}
                  </Fragment>
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
                  <span className="layout-sidebar-utilities">
                    <HelpMenu />
                    <ThemeModeButton theme={theme} onToggle={() => setTheme((current) => toggledColorTheme(current))} />
                  </span>
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
  );
}

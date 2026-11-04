import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, Outlet, useMatch, useNavigate } from 'react-router-dom';
import flowraLogo from '@/assets/flowra.svg';
import { useAuth } from '@/features/auth/context/AuthContext';
import type { GraphMode } from '@/features/map/components/GraphModeTabs';
import { GraphSnapshotsProvider } from '@/features/map/context/GraphSnapshotsContext';
import { WorkspaceModeProvider, useWorkspaceMode } from '@/features/map/context/WorkspaceModeContext';
import type { MapLocationState } from '@/features/map/utils/mapNavigation';
import { COLOR_THEME_STORAGE_KEY, storedColorTheme, toggledColorTheme, type ColorTheme } from './colorTheme';
import { HelpMenu } from './HelpMenu';
import { NavigationIcon } from './NavigationIcon';
import { SettingsMenu } from './SettingsMenu';
import { SidebarCollapseButton } from './SidebarCollapseButton';
import { SidebarNavItem } from './SidebarNavItem';
import { SidebarProfile } from './SidebarProfile';
import { ThemeToggle } from './ThemeToggle';
import './sidebar.css';
import { SIDEBAR_COLLAPSED_STORAGE_KEY, storedSidebarCollapsed } from './sidebarCollapse';
import { mainNavigationEntries } from './sidebarModel';
import { moveSidebarFocus, primeSidebarTabStops, rememberSidebarTabStop } from './sidebarRoving';

const navigationEntries = mainNavigationEntries();

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
  const isOnCartography = onCartography != null;
  const { mode, sandboxDirty } = useWorkspaceMode();
  const sidebarRef = useRef<HTMLElement>(null);
  const [theme, setTheme] = useState<ColorTheme>(() =>
    storedColorTheme(localStorage.getItem(COLOR_THEME_STORAGE_KEY)),
  );
  const [isCollapsed, setIsCollapsed] = useState(() =>
    storedSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)),
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(COLOR_THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(isCollapsed));
  }, [isCollapsed]);

  useLayoutEffect(() => {
    if (!sidebarRef.current) return;
    primeSidebarTabStops(sidebarRef.current);
  }, [user, isCollapsed, mode]);

  function openWorkspaceMode(next: GraphMode) {
    if (onCartography && mode === next) return;
    navigate('/map', { state: { graphMode: next } satisfies MapLocationState });
  }

  function signOut() {
    logout();
    navigate('/login', { replace: true });
  }

  function toggleSidebar() {
    setIsCollapsed((collapsed) => !collapsed);
  }

  return (
    <div className="layout">
      <aside
        className={isCollapsed ? 'layout-sidebar is-collapsed' : 'layout-sidebar'}
        ref={sidebarRef}
        onKeyDown={(event) => {
          if (!sidebarRef.current) return;
          moveSidebarFocus(event, sidebarRef.current);
        }}
        onFocusCapture={(event) => {
          if (!sidebarRef.current) return;
          rememberSidebarTabStop(event.target, sidebarRef.current);
        }}
      >
        <div className="layout-brand-row">
          <Link to="/about" className="layout-brand layout-brand-link">
            <img src={flowraLogo} alt="" className="layout-brand-logo" aria-hidden />
            <h1>Flowra</h1>
          </Link>
          <SidebarCollapseButton isCollapsed={isCollapsed} onToggle={toggleSidebar} />
        </div>
        {user ? (
          <>
            <nav className="layout-sidebar-nav" aria-label="Main navigation">
              {navigationEntries.map((entry) => (
                <Fragment key={entry.to}>
                  {entry.to === '/map' ? (
                    <>
                      <SidebarNavItem
                        label={entry.label}
                        to={entry.to}
                        end={entry.isEnd}
                        badge={entry.badge}
                        showSeparator={entry.showSeparator}
                        icon={<NavigationIcon name={entry.icon} />}
                        isCurrent={isOnCartography && mode === 'normal'}
                        onClick={(event) => {
                          event.preventDefault();
                          openWorkspaceMode('normal');
                        }}
                      />
                      <SidebarNavItem
                        label="Sandbox"
                        icon={<NavigationIcon name="sandbox" />}
                        isActive={isOnCartography && mode === 'sandbox'}
                        onClick={() => openWorkspaceMode('sandbox')}
                        trailing={
                          isOnCartography && mode === 'sandbox' && sandboxDirty ? (
                            <span className="graph-mode-tab__draft" aria-label="Unsaved draft" />
                          ) : null
                        }
                      />
                    </>
                  ) : (
                    <SidebarNavItem
                      label={entry.label}
                      to={entry.to}
                      end={entry.isEnd}
                      badge={entry.badge}
                      showSeparator={entry.showSeparator}
                      icon={<NavigationIcon name={entry.icon} />}
                    />
                  )}
                </Fragment>
              ))}
            </nav>
            <div className="sidebar-footer">
              <HelpMenu />
              <SettingsMenu />
              <div className="sidebar-account">
                <SidebarProfile username={user.username} roles={user.roles} onSignOut={signOut} />
                <ThemeToggle theme={theme} onToggle={() => setTheme((current) => toggledColorTheme(current))} />
              </div>
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

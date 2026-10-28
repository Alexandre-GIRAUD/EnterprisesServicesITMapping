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
import { SidebarNavItem } from './SidebarNavItem';
import { SidebarProfile } from './SidebarProfile';
import { ThemeToggle } from './ThemeToggle';
import { WorkspaceModeNav } from './WorkspaceModeNav';
import './sidebar.css';
import { mainNavigationEntries, shouldOpenWorkspace } from './sidebarModel';
import { moveSidebarFocus, primeSidebarTabStops, rememberSidebarTabStop } from './sidebarRoving';

const navigationEntries = mainNavigationEntries();
const CARTOGRAPHY_MODES_ID = 'cartography-modes';

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
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(isOnCartography);
  const wasOnCartography = useRef(isOnCartography);
  const { mode, sandboxDirty } = useWorkspaceMode();
  const sidebarRef = useRef<HTMLElement>(null);
  const [theme, setTheme] = useState<ColorTheme>(() =>
    storedColorTheme(localStorage.getItem(COLOR_THEME_STORAGE_KEY)),
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(COLOR_THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (shouldOpenWorkspace(wasOnCartography.current, isOnCartography)) setIsWorkspaceOpen(true);
    if (wasOnCartography.current && !isOnCartography) setIsWorkspaceOpen(false);
    wasOnCartography.current = isOnCartography;
  }, [isOnCartography]);

  useLayoutEffect(() => {
    if (!sidebarRef.current) return;
    primeSidebarTabStops(sidebarRef.current);
  }, [user, isWorkspaceOpen]);

  function openWorkspaceMode(next: GraphMode) {
    if (onCartography && mode === next) return;
    navigate('/map', { state: { graphMode: next } satisfies MapLocationState });
  }

  function signOut() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="layout">
      <aside
        className="layout-sidebar"
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
        </div>
        {user ? (
          <>
            <nav className="layout-sidebar-nav" aria-label="Main navigation">
              {navigationEntries.map((entry) => (
                <Fragment key={entry.to}>
                  {entry.to === '/map' ? (
                    <div className="sidebar-nav-row">
                      <SidebarNavItem
                        label={entry.label}
                        to={entry.to}
                        end={entry.isEnd}
                        badge={entry.badge}
                        showSeparator={entry.showSeparator}
                        icon={<NavigationIcon name={entry.icon} />}
                      />
                      <button
                        type="button"
                        className="sidebar-disclosure"
                        data-sidebar-item=""
                        aria-expanded={isWorkspaceOpen}
                        aria-controls={CARTOGRAPHY_MODES_ID}
                        aria-label="Cartography views"
                        onClick={() => setIsWorkspaceOpen((open) => !open)}
                      >
                        <NavigationIcon name="chevronDown" />
                      </button>
                    </div>
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
                  {entry.to === '/map' && isWorkspaceOpen ? (
                    <WorkspaceModeNav
                      id={CARTOGRAPHY_MODES_ID}
                      mode={onCartography ? mode : null}
                      sandboxDirty={Boolean(onCartography && sandboxDirty)}
                      onModeChange={openWorkspaceMode}
                    />
                  ) : null}
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

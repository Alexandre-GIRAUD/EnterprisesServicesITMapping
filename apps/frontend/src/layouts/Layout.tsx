import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import flowraLogo from '@/assets/flowra.svg.svg';
import { useAuth } from '@/features/auth/context/AuthContext';
import { GraphSnapshotsProvider } from '@/features/map/context/GraphSnapshotsContext';
import type { MapLocationState } from '@/features/map/utils/mapNavigation';
import { COLOR_THEME_STORAGE_KEY, storedColorTheme, toggledColorTheme, type ColorTheme } from './colorTheme';
import { SettingsMenu } from './SettingsMenu';
import { HelpMenu } from './HelpMenu';
import { ThemeModeButton } from './ThemeModeButton';

function navigationLinkClassName({ isActive }: { isActive: boolean }) {
  return `layout-header-link${isActive ? ' is-active' : ''}`;
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
        <header className="layout-header">
          <div className="layout-header-inner">
            <div className="layout-header-brand-group">
              <Link
                to="/map"
                state={{ graphMode: 'normal' } satisfies MapLocationState}
                className="layout-brand layout-brand-link"
              >
                <img src={flowraLogo} alt="" className="layout-brand-logo" aria-hidden />
                <h1>Flowra</h1>
              </Link>
              {user ? (
                <span className="layout-header-user-meta">
                  <span className="layout-header-user" title={user.username}>
                    {user.username}
                  </span>
                  {roleLabel ? (
                    <span className="layout-header-role" title={roleLabel}>
                      {roleLabel}
                    </span>
                  ) : null}
                  <ThemeModeButton theme={theme} onToggle={() => setTheme((current) => toggledColorTheme(current))} />
                  <HelpMenu />
                </span>
              ) : null}
            </div>
            <div className="layout-header-actions">
              {user ? (
                <>
                  <NavLink
                    to="/map"
                    end
                    state={{ graphMode: 'normal' } satisfies MapLocationState}
                    className={navigationLinkClassName}
                  >
                    Cartography
                  </NavLink>
                  <NavLink to="/data-model" className={navigationLinkClassName}>
                    Data Model
                  </NavLink>
                  <NavLink to="/map/import-github" className={navigationLinkClassName}>
                    Sources
                  </NavLink>
                  <NavLink to="/admin/changes" className={navigationLinkClassName}>
                    Changes
                  </NavLink>
                  <SettingsMenu />
                </>
              ) : null}
              {user ? (
                <button
                  type="button"
                  className="layout-header-btn"
                  onClick={() => {
                    logout();
                    navigate('/login', { replace: true });
                  }}
                >
                  Sign out
                </button>
              ) : null}
            </div>
          </div>
        </header>
        <main className="layout-main">
          <Outlet />
        </main>
      </div>
    </GraphSnapshotsProvider>
  );
}

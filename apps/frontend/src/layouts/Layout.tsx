import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import flowraLogo from '@/assets/flowra.svg.svg';
import { useAuth } from '@/features/auth/context/AuthContext';
import { GraphSnapshotsProvider } from '@/features/map/context/GraphSnapshotsContext';
import type { MapLocationState } from '@/features/map/utils/mapNavigation';

function navigationLinkClassName({ isActive }: { isActive: boolean }) {
  return `layout-header-link${isActive ? ' is-active' : ''}`;
}

export function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const roleLabel = user?.roles?.length ? user.roles.join(' · ') : null;

  return (
    <GraphSnapshotsProvider>
      <div className="layout">
        <header className="layout-header">
          <div className="layout-header-inner">
            <div className="layout-header-brand-group">
              <Link to="/map" className="layout-brand layout-brand-link">
                <img src={flowraLogo} alt="" className="layout-brand-logo" aria-hidden />
                <h1>admin</h1>
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
                </span>
              ) : null}
            </div>
            {user ? (
              <div className="layout-header-actions">
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
                {isAdmin ? (
                  <NavLink to="/admin/users" className={navigationLinkClassName}>
                    Admin
                  </NavLink>
                ) : null}
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
              </div>
            ) : null}
          </div>
        </header>
        <main className="layout-main">
          <Outlet />
        </main>
      </div>
    </GraphSnapshotsProvider>
  );
}

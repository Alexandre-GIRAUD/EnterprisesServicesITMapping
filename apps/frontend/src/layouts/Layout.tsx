import { Link, Outlet, useNavigate } from 'react-router-dom';
import flowraLogo from '@/assets/flowra.svg.svg';
import { useAuth } from '@/features/auth/context/AuthContext';
import { GraphSnapshotsProvider } from '@/features/map/context/GraphSnapshotsContext';
import type { MapLocationState } from '@/features/map/utils/mapNavigation';

export function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <GraphSnapshotsProvider>
      <div className="layout">
        <header className="layout-header">
          <div className="layout-header-inner">
            <Link to="/map" className="layout-brand layout-brand-link">
              <img src={flowraLogo} alt="" className="layout-brand-logo" aria-hidden />
              <h1>Flowra.AI</h1>
            </Link>
            {user ? (
              <div className="layout-header-actions">
                <Link
                  to="/map"
                  state={{ graphMode: 'normal' } satisfies MapLocationState}
                  className="layout-header-link"
                >
                  Cartography
                </Link>
                <Link to="/data-model" className="layout-header-link">
                  Data Model
                </Link>
                <Link to="/map/import-github" className="layout-header-link">
                  Sources
                </Link>
                {isAdmin ? (
                  <Link to="/admin/users" className="layout-header-link">
                    Admin
                  </Link>
                ) : null}
                <span className="layout-header-user" title={user.username}>
                  {user.username}
                </span>
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

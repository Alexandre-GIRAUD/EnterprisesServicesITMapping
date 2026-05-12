import { Link, Outlet, useNavigate } from 'react-router-dom';
import flowraLogo from '@/assets/flowra.svg.svg';
import { useAuth } from '@/features/auth/context/AuthContext';

export function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="layout">
      <header className="layout-header">
        <div className="layout-header-inner">
          <Link to="/map" className="layout-brand layout-brand-link">
            <img src={flowraLogo} alt="" className="layout-brand-logo" aria-hidden />
            <h1>Flowra.AI</h1>
          </Link>
          {user ? (
            <div className="layout-header-actions">
              {isAdmin ? (
                <Link to="/admin/users" className="layout-header-link">
                  Utilisateurs
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
                Déconnexion
              </button>
            </div>
          ) : null}
        </div>
      </header>
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  );
}

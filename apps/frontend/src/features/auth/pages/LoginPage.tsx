import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import flowraLogo from '@/assets/flowra.svg.svg';
import { useAuth } from '@/features/auth/context/AuthContext';
import { loginRequest } from '@/features/auth/api/authApi';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/map';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const dto = await loginRequest(username.trim(), password);
      login(dto);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-page-stack">
        <header className="auth-brand">
          <img src={flowraLogo} alt="" className="auth-brand-logo" aria-hidden />
          <h1 className="auth-brand-title">admin</h1>
        </header>

        <div className="auth-card">
          <h2 className="auth-section-title">Sign in</h2>
          <p className="auth-subtitle">Access the application map</p>
          <form className="auth-form" onSubmit={onSubmit}>
            <label className="auth-label">
              Username
              <input
                className="auth-input"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </label>
            <label className="auth-label">
              Password
              <input
                className="auth-input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {error ? (
              <p className="auth-error" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" className="auth-submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <p className="auth-footnote">Accounts are created by an administrator.</p>
        </div>
      </div>
    </div>
  );
}

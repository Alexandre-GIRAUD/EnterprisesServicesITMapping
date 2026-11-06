import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/AuthContext';
import {
  EmailNotVerifiedError,
  fetchPublicConfig,
  loginRequest,
} from '@/features/auth/api/authApi';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { CheckInbox } from '@/features/auth/components/CheckInbox';
import { HOME_PATH } from '@/features/auth/routes';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? HOME_PATH;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [isSignupEnabled, setIsSignupEnabled] = useState(false);

  useEffect(() => {
    fetchPublicConfig()
      .then((config) => setIsSignupEnabled(config.signupEnabled))
      .catch(() => setIsSignupEnabled(false));
  }, []);

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
      if (err instanceof EmailNotVerifiedError) {
        setUnverifiedEmail(username.trim());
      } else {
        setError(err instanceof Error ? err.message : 'Login failed.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (unverifiedEmail) {
    return (
      <AuthLayout>
        <CheckInbox email={unverifiedEmail} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h2 className="auth-section-title">Sign in</h2>
      <p className="auth-subtitle">Access the application map</p>
      <form className="auth-form" onSubmit={onSubmit}>
        <label className="auth-label">
          Email or username
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
      {isSignupEnabled ? (
        <p className="auth-footnote">
          New to Flowra?{' '}
          <Link className="auth-link" to="/signup">
            Create a workspace
          </Link>
        </p>
      ) : (
        <p className="auth-footnote">Accounts are created by an administrator.</p>
      )}
    </AuthLayout>
  );
}

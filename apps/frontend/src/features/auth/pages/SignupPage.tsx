import { FormEvent, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { MIN_PASSWORD_LENGTH, signupRequest } from '@/features/auth/api/authApi';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { CheckInbox } from '@/features/auth/components/CheckInbox';
import { useAuth } from '@/features/auth/context/AuthContext';
import { HOME_PATH } from '@/features/auth/routes';

export function SignupPage() {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (user) {
    return <Navigate to={HOME_PATH} replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsBusy(true);
    try {
      const accepted = await signupRequest(email.trim(), password, workspaceName.trim());
      setSentTo(accepted.email);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Signup failed.');
    } finally {
      setIsBusy(false);
    }
  }

  if (sentTo) {
    return (
      <AuthLayout>
        <CheckInbox email={sentTo} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h2 className="auth-section-title">Create your workspace</h2>
      <p className="auth-subtitle">You will be its administrator and can invite your team later.</p>
      <form className="auth-form" onSubmit={onSubmit}>
        <label className="auth-label">
          Work email
          <input
            className="auth-input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="auth-label">
          Password
          <input
            className="auth-input"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <label className="auth-label">
          Workspace name
          <input
            className="auth-input"
            autoComplete="organization"
            placeholder="Your company"
            value={workspaceName}
            onChange={(event) => setWorkspaceName(event.target.value)}
            required
          />
        </label>
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="auth-submit" disabled={isBusy}>
          {isBusy ? 'Creating…' : 'Create workspace'}
        </button>
      </form>
      <p className="auth-footnote">
        Already have an account?{' '}
        <Link className="auth-link" to="/login">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

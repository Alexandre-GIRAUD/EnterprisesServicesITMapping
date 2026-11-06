import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MIN_PASSWORD_LENGTH, resetPasswordRequest } from '@/features/auth/api/authApi';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { useAuth } from '@/features/auth/context/AuthContext';
import { HOME_PATH, TOKEN_SEARCH_PARAM } from '@/features/auth/routes';

/** Target of the emailed reset link: choose a new password, then open the map signed in. */
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get(TOKEN_SEARCH_PARAM) ?? '';
  const { login } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsBusy(true);
    try {
      const session = await resetPasswordRequest(token, password);
      login(session);
      navigate(HOME_PATH, { replace: true });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not reset the password.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <AuthLayout>
      <h2 className="auth-section-title">Choose a new password</h2>
      <form className="auth-form" onSubmit={onSubmit}>
        <label className="auth-label">
          New password
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
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="auth-submit" disabled={isBusy}>
          {isBusy ? 'Saving…' : 'Save and sign in'}
        </button>
      </form>
      <p className="auth-footnote">
        <Link className="auth-link" to="/forgot-password">
          Ask for a new link
        </Link>
      </p>
    </AuthLayout>
  );
}

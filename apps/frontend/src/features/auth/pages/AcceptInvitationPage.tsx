import { FormEvent, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MIN_PASSWORD_LENGTH } from '@/features/auth/api/authApi';
import { acceptInvitationRequest } from '@/features/auth/api/invitationsApi';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { useAuth } from '@/features/auth/context/AuthContext';
import { HOME_PATH } from '@/features/auth/routes';

/**
 * Target of the emailed invitation: choose a password, then open the map in the inviting
 * workspace. Any session already open in this browser is replaced.
 */
export function AcceptInvitationPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
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
      const session = await acceptInvitationRequest(token, password);
      login(session);
      navigate(HOME_PATH, { replace: true });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not accept the invitation.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <AuthLayout>
      <h2 className="auth-section-title">Join your workspace</h2>
      <p className="auth-subtitle">Choose the password you will sign in with.</p>
      <form className="auth-form" onSubmit={onSubmit}>
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
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="auth-submit" disabled={isBusy}>
          {isBusy ? 'Joining…' : 'Join workspace'}
        </button>
      </form>
    </AuthLayout>
  );
}

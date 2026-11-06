import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPasswordRequest } from '@/features/auth/api/authApi';
import { AuthLayout } from '@/features/auth/components/AuthLayout';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsBusy(true);
    try {
      await forgotPasswordRequest(email.trim());
      setIsSent(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not send the reset email.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <AuthLayout>
      <h2 className="auth-section-title">Reset your password</h2>
      {isSent ? (
        <p className="auth-success" role="status">
          If an account uses this email, a link to choose a new password is on its way. It expires
          in 1 hour.
        </p>
      ) : (
        <>
          <p className="auth-subtitle">Enter the email of your account to receive a link.</p>
          <form className="auth-form" onSubmit={onSubmit}>
            <label className="auth-label">
              Email
              <input
                className="auth-input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            {error ? (
              <p className="auth-error" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" className="auth-submit" disabled={isBusy}>
              {isBusy ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        </>
      )}
      <p className="auth-footnote">
        <Link className="auth-link" to="/login">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

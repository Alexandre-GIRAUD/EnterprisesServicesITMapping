import { useState } from 'react';
import { Link } from 'react-router-dom';
import { resendVerificationRequest } from '@/features/auth/api/authApi';

type ResendState = 'idle' | 'sending' | 'sent' | 'failed';

/** Shown after signup, or when an unconfirmed account tries to sign in. */
export function CheckInbox({ email }: { email: string }) {
  const [resendState, setResendState] = useState<ResendState>('idle');

  async function resend() {
    setResendState('sending');
    try {
      await resendVerificationRequest(email);
      setResendState('sent');
    } catch {
      setResendState('failed');
    }
  }

  return (
    <>
      <h2 className="auth-section-title">Check your inbox</h2>
      <p className="auth-subtitle">
        We sent a confirmation link to <strong>{email}</strong>. It expires in 24 hours.
      </p>
      {resendState === 'sent' ? (
        <p className="auth-success" role="status">
          If this account still needs confirming, a new link is on its way.
        </p>
      ) : null}
      {resendState === 'failed' ? (
        <p className="auth-error" role="alert">
          Could not resend the email. Try again in a moment.
        </p>
      ) : null}
      <button
        type="button"
        className="auth-submit"
        onClick={resend}
        disabled={resendState === 'sending'}
      >
        {resendState === 'sending' ? 'Sending…' : 'Resend email'}
      </button>
      <p className="auth-footnote">
        Already confirmed?{' '}
        <Link className="auth-link" to="/login">
          Sign in
        </Link>
      </p>
    </>
  );
}

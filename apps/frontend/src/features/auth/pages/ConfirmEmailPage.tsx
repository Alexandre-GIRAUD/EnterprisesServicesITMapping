import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { confirmEmailChangeRequest } from '@/features/auth/api/accountApi';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { useAuth } from '@/features/auth/context/AuthContext';

const SETTINGS_PATH = '/settings';

/** Target of the email change link: applies the new address, signs in, opens Settings. */
export function ConfirmEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  // The token is single use: React's double effect run in development must not spend it twice.
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    confirmEmailChangeRequest(token)
      .then((session) => {
        login(session);
        navigate(SETTINGS_PATH, { replace: true });
      })
      .catch((failure: unknown) => {
        setError(failure instanceof Error ? failure.message : 'This link could not be used.');
      });
  }, [token, login, navigate]);

  return (
    <AuthLayout>
      <h2 className="auth-section-title">Confirming your new email</h2>
      {error ? (
        <>
          <p className="auth-error" role="alert">
            {error}
          </p>
          <p className="auth-footnote">
            <Link className="auth-link" to="/login">
              Back to sign in
            </Link>
          </p>
        </>
      ) : (
        <p className="auth-subtitle" role="status">
          Saving your email…
        </p>
      )}
    </AuthLayout>
  );
}

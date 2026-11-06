import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { verifyEmailRequest } from '@/features/auth/api/authApi';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { useAuth } from '@/features/auth/context/AuthContext';
import { HOME_PATH, TOKEN_SEARCH_PARAM } from '@/features/auth/routes';

/** Target of the emailed link: confirms the address, signs in, opens the map. */
export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get(TOKEN_SEARCH_PARAM) ?? '';
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  // The token is single use: React's double effect run in development must not spend it twice.
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    verifyEmailRequest(token)
      .then((session) => {
        login(session);
        navigate(HOME_PATH, { replace: true });
      })
      .catch((failure: unknown) => {
        setError(failure instanceof Error ? failure.message : 'This link could not be used.');
      });
  }, [token, login, navigate]);

  return (
    <AuthLayout>
      <h2 className="auth-section-title">Confirming your email</h2>
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
          Opening your workspace…
        </p>
      )}
    </AuthLayout>
  );
}

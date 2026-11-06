import { FormEvent, useEffect, useState } from 'react';
import { fetchAccountRequest, requestEmailChange } from '@/features/auth/api/accountApi';
import { fetchPublicConfig } from '@/features/auth/api/authApi';

/** The account email: shown always, changed through a link sent to the new address. */
export function EmailSettings() {
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [isMailEnabled, setIsMailEnabled] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAccountRequest()
      .then((account) => setCurrentEmail(account.email))
      .catch((failure: unknown) =>
        setError(failure instanceof Error ? failure.message : 'Could not load your account.'),
      );
    fetchPublicConfig()
      .then((config) => setIsMailEnabled(config.mailEnabled))
      .catch(() => setIsMailEnabled(false));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const address = newEmail.trim();
    setError(null);
    setSentTo(null);
    setIsBusy(true);
    try {
      await requestEmailChange(address);
      setSentTo(address);
      setNewEmail('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not change the email.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="admin-users-panel" aria-label="Email">
      <h2>Email</h2>
      <p className="admin-users-lead">
        {currentEmail ? `Your account email is ${currentEmail}.` : 'Your account has no email yet.'}
      </p>
      {isMailEnabled ? (
        <form className="auth-form" onSubmit={onSubmit}>
          <label className="auth-label">
            New email
            <input
              className="auth-input"
              type="email"
              autoComplete="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              required
            />
          </label>
          <button type="submit" className="auth-submit" disabled={isBusy}>
            {isBusy ? 'Sending…' : 'Send confirmation link'}
          </button>
        </form>
      ) : null}
      {sentTo ? (
        <p className="auth-success" role="status">
          Check your inbox at {sentTo}: the change applies once you open the link.
        </p>
      ) : null}
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

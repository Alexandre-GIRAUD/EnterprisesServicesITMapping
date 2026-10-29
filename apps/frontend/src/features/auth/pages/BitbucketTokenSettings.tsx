import { useEffect, useState, type FormEvent } from 'react';
import {
  disconnectBitbucket,
  fetchBitbucketConnection,
  saveBitbucketToken,
  type BitbucketConnection,
} from '@/features/map/api/integrationsBitbucketApi';

export function BitbucketTokenSettings() {
  const [connection, setConnection] = useState<BitbucketConnection | null>(null);
  const [personalToken, setPersonalToken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchBitbucketConnection()
      .then((linked) => {
        if (!cancelled) setConnection(linked);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'Unable to load the Bitbucket connection.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function savePersonalToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setIsConnecting(true);
      setErrorMessage(null);
      const linked = await saveBitbucketToken(personalToken);
      setConnection(linked);
      setPersonalToken('');
      setSuccessMessage(linked.username ? `Connected as ${linked.username}.` : 'Bitbucket account saved.');
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save the Bitbucket token.');
    } finally {
      setIsConnecting(false);
    }
  }

  async function disconnectAccount() {
    try {
      setIsConnecting(true);
      setErrorMessage(null);
      await disconnectBitbucket();
      setConnection({ connected: false, username: null });
      setSuccessMessage('Bitbucket account disconnected.');
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to disconnect Bitbucket.');
    } finally {
      setIsConnecting(false);
    }
  }

  return (
    <section className="admin-users-panel" aria-label="Bitbucket token">
      <h2>Bitbucket</h2>
      <p className="admin-users-lead">
        Paste a Bitbucket API token to list your repositories. It is stored on your account only and
        is not shown again. Disconnecting Bitbucket leaves the GitHub connection unchanged.
      </p>
      {connection?.connected ? (
        <div className="github-import-account">
          <span>Connected as {connection.username}</span>
          <button
            type="button"
            className="github-import-text-button"
            disabled={isConnecting}
            onClick={() => void disconnectAccount()}
          >
            Disconnect
          </button>
        </div>
      ) : (
        <form className="github-import-token-form" onSubmit={(event) => void savePersonalToken(event)}>
          <input
            className="github-import-search-input"
            type="password"
            name="bitbucket-token"
            autoComplete="off"
            placeholder="Bitbucket token"
            aria-label="Bitbucket token"
            value={personalToken}
            disabled={isConnecting}
            onChange={(event) => setPersonalToken(event.target.value)}
          />
          <button
            type="submit"
            className="github-import-primary"
            disabled={isConnecting || personalToken.trim().length === 0}
          >
            Save token
          </button>
        </form>
      )}
      {errorMessage ? (
        <p className="github-import-state github-import-state-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p className="github-import-feedback github-import-feedback-success" role="status">
          {successMessage}
        </p>
      ) : null}
    </section>
  );
}

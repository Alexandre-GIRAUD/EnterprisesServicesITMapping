import { useEffect, useState, type FormEvent } from 'react';
import {
  disconnectGitHub,
  fetchGitHubConnection,
  saveGitHubToken,
  type GitHubConnection,
} from '@/features/map/api/integrationsGithubApi';

export function GitHubTokenSettings() {
  const [connection, setConnection] = useState<GitHubConnection | null>(null);
  const [personalToken, setPersonalToken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchGitHubConnection()
      .then((linked) => {
        if (!cancelled) setConnection(linked);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'Unable to load the GitHub connection.');
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
      const linked = await saveGitHubToken(personalToken);
      setConnection(linked);
      setPersonalToken('');
      setSuccessMessage(linked.login ? `Connected as ${linked.login}.` : 'GitHub account saved.');
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save the GitHub token.');
    } finally {
      setIsConnecting(false);
    }
  }

  async function disconnectAccount() {
    try {
      setIsConnecting(true);
      setErrorMessage(null);
      await disconnectGitHub();
      setConnection({ connected: false, login: null });
      setSuccessMessage('GitHub account disconnected.');
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to disconnect GitHub.');
    } finally {
      setIsConnecting(false);
    }
  }

  return (
    <section className="admin-users-panel" aria-label="GitHub token">
      <h2>GitHub</h2>
      <p className="admin-users-lead">
        Paste a GitHub personal access token to list your repositories. It is stored on your account
        only and is not shown again.
      </p>
      {connection?.connected ? (
        <div className="github-import-account">
          <span>Connected as {connection.login}</span>
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
            name="github-token"
            autoComplete="off"
            placeholder="GitHub token"
            aria-label="GitHub token"
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

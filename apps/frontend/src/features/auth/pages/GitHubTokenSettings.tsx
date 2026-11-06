import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/features/auth/context/AuthContext';
import {
  disconnectGitHub,
  fetchGitHubConnection,
  saveGitHubToken,
  type GitHubConnection,
} from '@/features/map/api/integrationsGithubApi';

export function GitHubTokenSettings() {
  const { isAdmin } = useAuth();
  const [connection, setConnection] = useState<GitHubConnection | null>(null);
  const [workspaceToken, setWorkspaceToken] = useState('');
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
          setErrorMessage(
            error instanceof Error ? error.message : 'Unable to load the GitHub connection.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveWorkspaceToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setIsConnecting(true);
      setErrorMessage(null);
      const linked = await saveGitHubToken(workspaceToken);
      setConnection(linked);
      setWorkspaceToken('');
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
        {isAdmin
          ? 'Paste a GitHub personal access token for the whole workspace. It is stored encrypted and is not shown again.'
          : 'The workspace administrators manage this connection.'}
      </p>
      {connection?.connected ? (
        <div className="github-import-account">
          <span>Connected as {connection.login} (workspace connection)</span>
          {isAdmin ? (
            <button
              type="button"
              className="github-import-text-button"
              disabled={isConnecting}
              onClick={() => void disconnectAccount()}
            >
              Disconnect
            </button>
          ) : null}
        </div>
      ) : !isAdmin ? (
        <p className="admin-users-lead">Not connected. Ask an administrator to connect GitHub.</p>
      ) : (
        <form
          className="github-import-token-form"
          onSubmit={(event) => void saveWorkspaceToken(event)}
        >
          <input
            className="github-import-search-input"
            type="password"
            name="github-token"
            autoComplete="off"
            placeholder="GitHub token"
            aria-label="GitHub token"
            value={workspaceToken}
            disabled={isConnecting}
            onChange={(event) => setWorkspaceToken(event.target.value)}
          />
          <button
            type="submit"
            className="github-import-primary"
            disabled={isConnecting || workspaceToken.trim().length === 0}
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

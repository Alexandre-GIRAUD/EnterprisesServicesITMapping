import { useEffect, useState } from 'react';
import {
  fetchGitHubWebhookSettings,
  regenerateGitHubWebhookSecret,
  type GitHubWebhookSettings as WebhookSettings,
} from '@/features/map/api/integrationsGithubApi';

/** What an admin pastes into GitHub's webhook form so pushes reach this workspace. */
export function GitHubWebhookSettings() {
  const [settings, setSettings] = useState<WebhookSettings | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchGitHubWebhookSettings()
      .then(setSettings)
      .catch((error: unknown) =>
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load the webhook.'),
      );
  }, []);

  async function copyValue(label: string, value: string) {
    setErrorMessage(null);
    try {
      await navigator.clipboard.writeText(value);
      setSuccessMessage(`${label} copied.`);
    } catch {
      setErrorMessage(`Could not copy the ${label.toLowerCase()}: select it and copy it by hand.`);
    }
  }

  async function regenerateSecret() {
    setIsBusy(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      setSettings(await regenerateGitHubWebhookSecret());
      setSuccessMessage('New secret created. Paste it into GitHub: the old one no longer works.');
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to regenerate the secret.');
    } finally {
      setIsBusy(false);
    }
  }

  const payloadUrl = settings ? window.location.origin + settings.path : '';

  return (
    <section className="admin-users-panel" aria-label="GitHub webhook">
      <h2>GitHub webhook</h2>
      <p className="admin-users-lead">
        In each repository, add a webhook with this payload URL, content type application/json, this
        secret and the push event.
      </p>
      {settings ? (
        <dl className="admin-users-list">
          <dt>Payload URL</dt>
          <dd>
            <code>{payloadUrl}</code>{' '}
            <button
              type="button"
              className="github-import-text-button"
              onClick={() => void copyValue('Payload URL', payloadUrl)}
            >
              Copy
            </button>
          </dd>
          <dt>Secret</dt>
          <dd>
            <code>{settings.secret}</code>{' '}
            <button
              type="button"
              className="github-import-text-button"
              onClick={() => void copyValue('Secret', settings.secret)}
            >
              Copy
            </button>
          </dd>
        </dl>
      ) : null}
      <button
        type="button"
        className="github-import-text-button"
        disabled={isBusy || settings === null}
        onClick={() => void regenerateSecret()}
      >
        Regenerate secret
      </button>
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

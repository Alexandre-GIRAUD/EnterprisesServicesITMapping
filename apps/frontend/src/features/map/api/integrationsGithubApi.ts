import type { GitHubRepoDto } from '@/types/api';
import { authenticatedFetch, resolveApiUrl } from '@/config/api';

export type GitHubConnection = {
  connected: boolean;
  login: string | null;
};

/**
 * Proxies through the backend, which uses the workspace GitHub connection. The browser never sees
 * a GitHub token.
 */
export async function fetchGitHubConnection(): Promise<GitHubConnection> {
  const res = await authenticatedFetch(resolveApiUrl('/api/integrations/github/connection'), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(await githubError('GitHub connection', res));
  }
  return res.json();
}

/** Saves the workspace token an admin pasted. The response does not include the token. */
export async function saveGitHubToken(token: string): Promise<GitHubConnection> {
  const res = await authenticatedFetch(resolveApiUrl('/api/integrations/github/connection'), {
    method: 'PUT',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    throw new Error(await githubError('GitHub token', res));
  }
  return res.json();
}

export async function disconnectGitHub(): Promise<void> {
  const res = await authenticatedFetch(resolveApiUrl('/api/integrations/github/connection'), {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(await githubError('GitHub disconnect', res));
  }
}

async function githubError(label: string, res: Response): Promise<string> {
  const detail = await res.text().catch(() => '');
  try {
    const parsed = JSON.parse(detail) as { message?: string };
    if (parsed.message) return parsed.message;
  } catch {
    // The body is not JSON.
  }
  return `${label} ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 400)}` : ''}`;
}

/** `path` is relative to the origin the browser uses for the app. */
export type GitHubWebhookSettings = { path: string; secret: string };

const WEBHOOK_SETTINGS_PATH = '/api/integrations/github/webhook';

export async function fetchGitHubWebhookSettings(): Promise<GitHubWebhookSettings> {
  const res = await authenticatedFetch(resolveApiUrl(WEBHOOK_SETTINGS_PATH), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(await githubError('GitHub webhook', res));
  }
  return res.json();
}

export async function regenerateGitHubWebhookSecret(): Promise<GitHubWebhookSettings> {
  const res = await authenticatedFetch(resolveApiUrl(`${WEBHOOK_SETTINGS_PATH}/secret`), {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(await githubError('GitHub webhook secret', res));
  }
  return res.json();
}

export async function fetchGitHubRepos(): Promise<GitHubRepoDto[]> {
  const url = resolveApiUrl('/api/integrations/github/repos');
  const res = await authenticatedFetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(await githubError('GitHub repos API', res));
  }

  return res.json();
}

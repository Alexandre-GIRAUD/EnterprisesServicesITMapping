import type { GitHubRepoDto } from '@/types/api';
import { authenticatedFetch, resolveApiUrl } from '@/config/api';

export type GitHubConnection = {
  connected: boolean;
  login: string | null;
};

/**
 * Proxies through the backend. A connected user uses their GitHub account; otherwise the server
 * token. The browser never sees a GitHub token.
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

/** Returns the GitHub authorize URL. The page navigates there. */
export async function startGitHubConnect(): Promise<string> {
  const res = await authenticatedFetch(resolveApiUrl('/api/integrations/github/connect'), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    if (res.status === 503) {
      throw new Error(
        'GitHub OAuth is not configured. Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET, then restart the backend.'
      );
    }
    throw new Error(await githubError('GitHub connect', res));
  }
  const body = (await res.json()) as { authorizeUrl?: string };
  if (!body.authorizeUrl) {
    throw new Error('GitHub connect did not return an authorize URL.');
  }
  return body.authorizeUrl;
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
  return `${label} ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 400)}` : ''}`;
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

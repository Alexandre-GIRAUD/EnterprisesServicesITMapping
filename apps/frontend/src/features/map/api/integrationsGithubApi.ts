import type { GitHubRepoDto } from '@/types/api';
import { authenticatedFetch, resolveApiUrl } from '@/config/api';

/**
 * Proxies through the backend (uses server-side GITHUB_TOKEN). Never calls GitHub from the browser.
 */
export async function fetchGitHubRepos(): Promise<GitHubRepoDto[]> {
  const url = resolveApiUrl('/api/integrations/github/repos');
  const res = await authenticatedFetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `GitHub repos API ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 400)}` : ''}`
    );
  }

  return res.json();
}

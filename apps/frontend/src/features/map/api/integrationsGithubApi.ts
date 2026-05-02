import type { GitHubRepoDto } from '@/types/api';

function resolveUrl(pathWithQuery: string): string {
  const origin = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
    /\/$/,
    ''
  );
  return origin ? `${origin}${pathWithQuery}` : pathWithQuery;
}

/**
 * Proxies through the backend (uses server-side GITHUB_TOKEN). Never calls GitHub from the browser.
 */
export async function fetchGitHubRepos(): Promise<GitHubRepoDto[]> {
  const url = resolveUrl('/api/integrations/github/repos');
  const res = await fetch(url, {
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

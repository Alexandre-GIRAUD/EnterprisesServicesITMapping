import type { BitbucketRepoDto } from '@/types/api';
import { authenticatedFetch, resolveApiUrl } from '@/config/api';

export type BitbucketConnection = {
  connected: boolean;
  username: string | null;
};

export async function fetchBitbucketConnection(): Promise<BitbucketConnection> {
  const res = await authenticatedFetch(resolveApiUrl('/api/integrations/bitbucket/connection'), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(await bitbucketError('Bitbucket connection', res));
  }
  return res.json();
}

export async function saveBitbucketToken(token: string): Promise<BitbucketConnection> {
  const res = await authenticatedFetch(resolveApiUrl('/api/integrations/bitbucket/connection'), {
    method: 'PUT',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    throw new Error(await bitbucketError('Bitbucket token', res));
  }
  return res.json();
}

export async function disconnectBitbucket(): Promise<void> {
  const res = await authenticatedFetch(resolveApiUrl('/api/integrations/bitbucket/connection'), {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(await bitbucketError('Bitbucket disconnect', res));
  }
}

export async function fetchBitbucketRepos(): Promise<BitbucketRepoDto[]> {
  const res = await authenticatedFetch(resolveApiUrl('/api/integrations/bitbucket/repos'), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(await bitbucketError('Bitbucket repos API', res));
  }
  return res.json();
}

async function bitbucketError(label: string, res: Response): Promise<string> {
  const detail = await res.text().catch(() => '');
  try {
    const parsed = JSON.parse(detail) as { message?: string };
    if (parsed.message) return parsed.message;
  } catch {
    // The body is not JSON.
  }
  return `${label} ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 400)}` : ''}`;
}

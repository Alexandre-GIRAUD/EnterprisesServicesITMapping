import { authenticatedFetch, resolveApiUrl } from '@/config/api';
import type { SandboxDocument } from '../utils/sandboxDocuments';
import type { SharedSandboxInboxItem } from '../utils/sandboxShare';

export async function shareSavedSandbox(
  username: string,
  name: string,
  document: SandboxDocument,
): Promise<void> {
  const res = await authenticatedFetch(resolveApiUrl('/api/users/me/sandbox-shares'), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, name, document }),
  });
  if (res.status === 204) return;
  const detail = await res.text().catch(() => '');
  if (detail.includes('partager avec vous')) throw new Error('You cannot share with yourself.');
  if (detail.includes('Utilisateur introuvable')) throw new Error('No user with that username.');
  if (detail.includes('trop volumineux')) throw new Error('That sandbox is too large to share.');
  throw new Error(`Share sandbox ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
}

export async function listSandboxShares(): Promise<SharedSandboxInboxItem<SandboxDocument>[]> {
  const res = await authenticatedFetch(resolveApiUrl('/api/users/me/sandbox-shares'), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Sandbox shares ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
  }
  return res.json();
}

export async function deleteSandboxShare(id: string): Promise<void> {
  const res = await authenticatedFetch(
    resolveApiUrl(`/api/users/me/sandbox-shares/${encodeURIComponent(id)}`),
    { method: 'DELETE' },
  );
  if (!res.ok && res.status !== 204) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Dismiss sandbox share ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
  }
}

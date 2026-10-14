import { authenticatedFetch, resolveApiUrl } from '@/config/api';
import type { SavedCustomTable } from '../utils/customTable';

export type SharedCustomTable = {
  id: string;
  name: string;
  senderUsername: string;
  document: SavedCustomTable;
};

export async function shareCustomTable(
  username: string,
  name: string,
  document: SavedCustomTable,
): Promise<void> {
  const res = await authenticatedFetch(resolveApiUrl('/api/users/me/custom-table-shares'), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, name, document }),
  });
  if (res.status === 204) return;
  const detail = await res.text().catch(() => '');
  if (detail.includes('partager avec vous')) throw new Error('You cannot share with yourself.');
  if (detail.includes('Utilisateur introuvable')) throw new Error('No user with that username.');
  if (detail.includes('trop volumineuse')) throw new Error('That table is too large to share.');
  throw new Error(`Share table ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
}

export async function listCustomTableShares(): Promise<SharedCustomTable[]> {
  const res = await authenticatedFetch(resolveApiUrl('/api/users/me/custom-table-shares'), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Table shares ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
  }
  return res.json();
}

export async function deleteCustomTableShare(id: string): Promise<void> {
  const res = await authenticatedFetch(
    resolveApiUrl(`/api/users/me/custom-table-shares/${encodeURIComponent(id)}`),
    { method: 'DELETE' },
  );
  if (!res.ok && res.status !== 204) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Dismiss table share ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
  }
}

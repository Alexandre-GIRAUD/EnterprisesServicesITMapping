import { authenticatedFetch, resolveApiUrl } from '@/config/api';
import type { SavedCustomTable } from '../utils/customTable';
import { messageForShareFailure } from './shareFailureMessage';

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
  const response = await authenticatedFetch(resolveApiUrl('/api/users/me/custom-table-shares'), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, name, document }),
  });
  if (response.status === 204) return;
  const detail = await response.text().catch(() => '');
  throw new Error(messageForShareFailure(response.status, detail));
}

export async function listCustomTableShares(): Promise<SharedCustomTable[]> {
  const response = await authenticatedFetch(resolveApiUrl('/api/users/me/custom-table-shares'), {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(messageForShareFailure(response.status, detail, 'Table shares'));
  }
  return response.json();
}

export async function deleteCustomTableShare(id: string): Promise<void> {
  const response = await authenticatedFetch(
    resolveApiUrl(`/api/users/me/custom-table-shares/${encodeURIComponent(id)}`),
    { method: 'DELETE' },
  );
  if (!response.ok && response.status !== 204) {
    const detail = await response.text().catch(() => '');
    throw new Error(messageForShareFailure(response.status, detail, 'Dismiss table share'));
  }
}

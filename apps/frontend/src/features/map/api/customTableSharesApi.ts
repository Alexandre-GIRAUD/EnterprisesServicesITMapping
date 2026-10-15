import { authenticatedFetch, resolveApiUrl } from '@/config/api';
import type { SavedCustomTable } from '../utils/customTable';

const ERROR_DETAIL_LIMIT = 200;
const CANNOT_SHARE_WITH_YOURSELF = 'You cannot share with yourself.';
const USER_NOT_FOUND = 'No user with that username.';
const TABLE_TOO_LARGE = 'That table is too large to share.';

export type SharedCustomTable = {
  id: string;
  name: string;
  senderUsername: string;
  document: SavedCustomTable;
};

function buildShareFailure(status: number, detail: string, fallback: string): Error {
  const clipped = detail ? `: ${detail.slice(0, ERROR_DETAIL_LIMIT)}` : '';
  return new Error(`${fallback} ${status}${clipped}`);
}

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
  if (detail.includes(CANNOT_SHARE_WITH_YOURSELF)) throw new Error(CANNOT_SHARE_WITH_YOURSELF);
  if (detail.includes(USER_NOT_FOUND)) throw new Error(USER_NOT_FOUND);
  if (detail.includes(TABLE_TOO_LARGE)) throw new Error(TABLE_TOO_LARGE);
  throw buildShareFailure(response.status, detail, 'Share table');
}

export async function listCustomTableShares(): Promise<SharedCustomTable[]> {
  const response = await authenticatedFetch(resolveApiUrl('/api/users/me/custom-table-shares'), {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw buildShareFailure(response.status, detail, 'Table shares');
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
    throw buildShareFailure(response.status, detail, 'Dismiss table share');
  }
}

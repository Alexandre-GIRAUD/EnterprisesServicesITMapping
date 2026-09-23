import type {
  AttributeOverrideConflictDto,
  AttributeOverrideConflictPageDto,
  OverrideConflictStatus,
} from '@/types/api';
import { authenticatedFetch, resolveApiUrl } from '@/config/api';

async function readError(res: Response, label: string): Promise<never> {
  const detail = await res.text().catch(() => '');
  throw new Error(
    `${label} ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 200)}` : ''}`
  );
}

export async function listOverrideConflicts(params?: {
  status?: OverrideConflictStatus;
  page?: number;
  size?: number;
}): Promise<AttributeOverrideConflictPageDto> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set('status', params.status);
  sp.set('page', String(params?.page ?? 0));
  sp.set('size', String(params?.size ?? 20));
  const url = resolveApiUrl(`/api/override-conflicts?${sp}`);
  const res = await authenticatedFetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) await readError(res, 'Override conflicts API');
  return res.json();
}

export async function fetchOverrideConflictPendingCount(): Promise<number> {
  const url = resolveApiUrl('/api/override-conflicts/pending-count');
  const res = await authenticatedFetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) await readError(res, 'Override conflicts count API');
  const data = (await res.json()) as { count: number };
  return data.count ?? 0;
}

export async function getOverrideConflict(id: string): Promise<AttributeOverrideConflictDto> {
  const url = resolveApiUrl(`/api/override-conflicts/${encodeURIComponent(id)}`);
  const res = await authenticatedFetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) await readError(res, 'Override conflict API');
  return res.json();
}

export async function acceptOverrideConflict(id: string): Promise<AttributeOverrideConflictDto> {
  const url = resolveApiUrl(`/api/override-conflicts/${encodeURIComponent(id)}/accept`);
  const res = await authenticatedFetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) await readError(res, 'Accept override conflict');
  return res.json();
}

export async function rejectOverrideConflict(id: string): Promise<AttributeOverrideConflictDto> {
  const url = resolveApiUrl(`/api/override-conflicts/${encodeURIComponent(id)}/reject`);
  const res = await authenticatedFetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) await readError(res, 'Reject override conflict');
  return res.json();
}

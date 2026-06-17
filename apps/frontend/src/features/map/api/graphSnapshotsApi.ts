import { authenticatedFetch, resolveApiUrl } from '@/config/api';
import type { GraphSnapshotDto, GraphSnapshotFilters } from '@/types/api';

export async function listGraphSnapshots(): Promise<GraphSnapshotDto[]> {
  const res = await authenticatedFetch(resolveApiUrl('/api/users/me/graph-snapshots'), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `View list ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`
    );
  }
  return res.json();
}

export async function createGraphSnapshot(
  name: string,
  filters: GraphSnapshotFilters
): Promise<GraphSnapshotDto> {
  const res = await authenticatedFetch(resolveApiUrl('/api/users/me/graph-snapshots'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, filters }),
  });
  const text = await res.text().catch(() => '');
  if (res.status === 409) {
    throw new Error('A view with this name already exists.');
  }
  if (!res.ok) {
    throw new Error(
      `Pin view ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`
    );
  }
  try {
    return JSON.parse(text) as GraphSnapshotDto;
  } catch {
    throw new Error('Invalid server response after save.');
  }
}

export async function deleteGraphSnapshot(id: string): Promise<void> {
  const res = await authenticatedFetch(
    resolveApiUrl(`/api/users/me/graph-snapshots/${encodeURIComponent(id)}`),
    { method: 'DELETE' }
  );
  if (res.status === 404) {
    throw new Error('View not found.');
  }
  if (!res.ok && res.status !== 204) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Delete view ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`
    );
  }
}

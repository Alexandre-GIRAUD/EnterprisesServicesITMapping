import { authenticatedFetch, resolveApiUrl } from '@/config/api';
import type { GraphSnapshotDto, GraphSnapshotFilters } from '@/types/api';

export async function listGraphSnapshots(): Promise<GraphSnapshotDto[]> {
  const res = await authenticatedFetch(resolveApiUrl('/api/users/me/graph-snapshots'), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Liste des vues ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`
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
    throw new Error('Une vue avec ce nom existe déjà.');
  }
  if (!res.ok) {
    throw new Error(
      `Enregistrement de la vue ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`
    );
  }
  try {
    return JSON.parse(text) as GraphSnapshotDto;
  } catch {
    throw new Error('Réponse serveur invalide après enregistrement.');
  }
}

export async function deleteGraphSnapshot(id: string): Promise<void> {
  const res = await authenticatedFetch(
    resolveApiUrl(`/api/users/me/graph-snapshots/${encodeURIComponent(id)}`),
    { method: 'DELETE' }
  );
  if (res.status === 404) {
    throw new Error('Vue introuvable.');
  }
  if (!res.ok && res.status !== 204) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Suppression de la vue ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`
    );
  }
}

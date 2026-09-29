import { authenticatedFetch, resolveApiUrl } from '@/config/api';
import type { GraphViewFolderDto } from '@/types/api';

async function readError(res: Response, fallback: string): Promise<never> {
  if (res.status === 409) throw new Error('An item with this name already exists.');
  if (res.status === 404) throw new Error('Folder not found.');
  if (res.status === 400) throw new Error('That folder cannot be placed there.');
  const detail = await res.text().catch(() => '');
  throw new Error(`${fallback} ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
}

export async function listGraphViewFolders(): Promise<GraphViewFolderDto[]> {
  const res = await authenticatedFetch(resolveApiUrl('/api/users/me/graph-view-folders'), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) await readError(res, 'Folder list');
  return res.json();
}

export async function createGraphViewFolder(
  name: string,
  parentId: string | null,
): Promise<GraphViewFolderDto> {
  const res = await authenticatedFetch(resolveApiUrl('/api/users/me/graph-view-folders'), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parentId }),
  });
  if (!res.ok) await readError(res, 'Create folder');
  return res.json();
}

export async function renameGraphViewFolder(id: string, name: string): Promise<GraphViewFolderDto> {
  const res = await authenticatedFetch(
    resolveApiUrl(`/api/users/me/graph-view-folders/${encodeURIComponent(id)}`),
    {
      method: 'PATCH',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    },
  );
  if (!res.ok) await readError(res, 'Rename folder');
  return res.json();
}

export async function moveGraphViewFolder(id: string, parentId: string | null): Promise<GraphViewFolderDto> {
  const res = await authenticatedFetch(
    resolveApiUrl(`/api/users/me/graph-view-folders/${encodeURIComponent(id)}/parent`),
    {
      method: 'PATCH',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId }),
    },
  );
  if (!res.ok) await readError(res, 'Move folder');
  return res.json();
}

export async function deleteGraphViewFolder(id: string): Promise<void> {
  const res = await authenticatedFetch(
    resolveApiUrl(`/api/users/me/graph-view-folders/${encodeURIComponent(id)}`),
    { method: 'DELETE' },
  );
  if (!res.ok && res.status !== 204) await readError(res, 'Delete folder');
}

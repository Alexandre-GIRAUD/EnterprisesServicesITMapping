import { authenticatedFetch, resolveApiUrl } from '@/config/api';
import type { ChangeDetectionRunDto } from '@/types/api';

export async function listChangeDetections(params?: {
  applicationId?: string;
  status?: string;
}): Promise<ChangeDetectionRunDto[]> {
  const sp = new URLSearchParams();
  if (params?.applicationId) sp.set('applicationId', params.applicationId);
  if (params?.status) sp.set('status', params.status);
  const q = sp.toString() ? `?${sp.toString()}` : '';
  const res = await authenticatedFetch(resolveApiUrl(`/api/change-detections${q}`), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Change detections API ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`
    );
  }
  return res.json();
}

export async function getChangeDetection(runId: string): Promise<ChangeDetectionRunDto> {
  const res = await authenticatedFetch(
    resolveApiUrl(`/api/change-detections/${encodeURIComponent(runId)}`),
    { headers: { Accept: 'application/json' } }
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Change detection ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`
    );
  }
  return res.json();
}

export async function acceptChangeDetectionItem(
  runId: string,
  itemId: string
): Promise<void> {
  const res = await authenticatedFetch(
    resolveApiUrl(`/api/change-detections/${encodeURIComponent(runId)}/items/${encodeURIComponent(itemId)}/accept`),
    { method: 'POST', headers: { Accept: 'application/json' } }
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail || `Accept failed (${res.status})`);
  }
}

export async function rejectChangeDetectionItem(
  runId: string,
  itemId: string
): Promise<void> {
  const res = await authenticatedFetch(
    resolveApiUrl(`/api/change-detections/${encodeURIComponent(runId)}/items/${encodeURIComponent(itemId)}/reject`),
    { method: 'POST', headers: { Accept: 'application/json' } }
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail || `Reject failed (${res.status})`);
  }
}

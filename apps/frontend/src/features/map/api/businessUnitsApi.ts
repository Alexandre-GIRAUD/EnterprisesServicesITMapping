import type { BusinessUnitCreateRequest, BusinessUnitListItem } from '@/types/api';
import { authenticatedFetch } from '@/config/api';

function resolveUrl(pathWithQuery: string): string {
  const origin = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '');
  return origin ? `${origin}${pathWithQuery}` : pathWithQuery;
}

export async function fetchBusinessUnits(): Promise<BusinessUnitListItem[]> {
  const res = await authenticatedFetch(resolveUrl('/api/business-units'), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Business units API ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 200)}` : ''}`
    );
  }
  return res.json();
}

export async function createBusinessUnit(
  payload: BusinessUnitCreateRequest
): Promise<BusinessUnitListItem> {
  const res = await authenticatedFetch(resolveUrl('/api/business-units'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Create business unit ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 200)}` : ''}`
    );
  }
  return res.json();
}

import type { RegionSummary } from '@/types/api';
import { authenticatedFetch } from '@/config/api';

function resolveUrl(pathWithQuery: string): string {
  const origin = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
    /\/$/,
    ''
  );
  return origin ? `${origin}${pathWithQuery}` : pathWithQuery;
}

/** Catalogue for multi-select (ordered by code on the server). */
export async function fetchRegions(): Promise<RegionSummary[]> {
  const url = resolveUrl('/api/regions');
  const res = await authenticatedFetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Regions API ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 200)}` : ''}`
    );
  }
  return res.json();
}

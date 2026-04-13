/**
 * Graph API client. Fetches graph data for Cytoscape.js (nodes + edges).
 * Supports temporal versioning via query param validAt (ISO instant).
 *
 * - Relative `/api/...` : same origin (Vite proxy en dev, nginx en prod Docker).
 * - VITE_API_BASE_URL=http://127.0.0.1:8081 : appel direct (CORS activé côté backend).
 */

import type { GraphResponseDto } from '@/types/api';

function graphUrl(search: string): string {
  const origin = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
    /\/$/,
    ''
  );
  const path = `/api/graph${search}`;
  return origin ? `${origin}${path}` : path;
}

export async function fetchGraph(params?: { validAt?: string }): Promise<GraphResponseDto> {
  const search = params?.validAt ? `?validAt=${encodeURIComponent(params.validAt)}` : '';
  const res = await fetch(graphUrl(search), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const hint =
      res.status === 502 || res.status === 503
        ? ' (vérifie que le backend tourne et le port du proxy Vite : VITE_API_PROXY_TARGET, ex. 8081)'
        : '';
    throw new Error(
      `Graph API ${res.status} ${res.statusText}${hint}${detail ? `: ${detail.slice(0, 200)}` : ''}`
    );
  }
  return res.json();
}

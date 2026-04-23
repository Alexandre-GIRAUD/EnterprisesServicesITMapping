/**
 * Graph API client. Fetches graph data for Cytoscape.js (nodes + edges).
 * Supports temporal versioning via query param validAt (ISO instant).
 *
 * - Relative `/api/...` : same origin (Vite proxy en dev, nginx en prod Docker).
 * - VITE_API_BASE_URL=http://127.0.0.1:8081 : appel direct (CORS activé côté backend).
 */

import type { GraphResponseDto } from '@/types/api';

function resolveUrl(pathWithQuery: string): string {
  const origin = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
    /\/$/,
    ''
  );
  return origin ? `${origin}${pathWithQuery}` : pathWithQuery;
}

function graphUrl(search: string): string {
  return resolveUrl(`/api/graph${search}`);
}

async function fetchGraphJson(
  url: string,
  label: string
): Promise<GraphResponseDto> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const hint =
      res.status === 502 || res.status === 503
        ? ' (vérifie que le backend tourne et le port du proxy Vite : VITE_API_PROXY_TARGET, ex. 8081)'
        : '';
    throw new Error(
      `${label} ${res.status} ${res.statusText}${hint}${detail ? `: ${detail.slice(0, 200)}` : ''}`
    );
  }
  return res.json();
}

export async function fetchGraph(params?: { validAt?: string }): Promise<GraphResponseDto> {
  const search = params?.validAt ? `?validAt=${encodeURIComponent(params.validAt)}` : '';
  return fetchGraphJson(graphUrl(search), 'Graph API');
}

/**
 * Module composition tree for one application (same DTO as {@link fetchGraph}).
 * Backend: GET /api/applications/{id}/module-graph
 */
export async function fetchModuleGraph(
  applicationId: string,
  params?: { validAt?: string }
): Promise<GraphResponseDto> {
  const search = params?.validAt ? `?validAt=${encodeURIComponent(params.validAt)}` : '';
  const path = `/api/applications/${encodeURIComponent(applicationId)}/module-graph${search}`;
  return fetchGraphJson(resolveUrl(path), 'Module graph API');
}

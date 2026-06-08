/**
 * Graph API client. Fetches graph data for Cytoscape.js (nodes + edges).
 * Supports filtering by year via query param year (integer).
 *
 * - Relative `/api/...` : same origin (Vite proxy en dev, nginx en prod Docker).
 * - VITE_API_BASE_URL=http://127.0.0.1:8081 : appel direct (CORS activé côté backend).
 */

import type { GraphEdgeCreateRequest, GraphEdgeCreateResponse, GraphResponseDto } from '@/types/api';
import { authenticatedFetch } from '@/config/api';

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
  const res = await authenticatedFetch(url, {
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

export async function fetchGraph(params?: {
  year?: number;
  applicationIds?: string[];
  businessUnitIds?: string[];
  regionCodes?: string[];
}): Promise<GraphResponseDto> {
  const sp = new URLSearchParams();
  if (params?.year != null) {
    sp.set('year', String(params.year));
  }
  for (const id of params?.applicationIds ?? []) {
    if (id) sp.append('applicationIds', id);
  }
  for (const id of params?.businessUnitIds ?? []) {
    if (id) sp.append('businessUnitIds', id);
  }
  for (const code of params?.regionCodes ?? []) {
    if (code) sp.append('regionCodes', code);
  }
  const search = sp.toString() ? `?${sp.toString()}` : '';
  return fetchGraphJson(graphUrl(search), 'Graph API');
}

/**
 * Module composition tree for one application (same DTO as {@link fetchGraph}).
 * Backend: GET /api/applications/{id}/module-graph
 */
export async function fetchModuleGraph(
  applicationId: string
): Promise<GraphResponseDto> {
  const path = `/api/applications/${encodeURIComponent(applicationId)}/module-graph`;
  return fetchGraphJson(resolveUrl(path), 'Module graph API');
}

export async function createGraphEdge(
  payload: GraphEdgeCreateRequest
): Promise<GraphEdgeCreateResponse> {
  const res = await authenticatedFetch(resolveUrl('/api/graph/edges'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    if (res.status === 404 || res.status === 405) {
      throw new Error(
        'API create edge non disponible pour le moment. Endpoint backend de creation de relation absent.'
      );
    }
    throw new Error(
      `Create edge API ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 200)}` : ''}`
    );
  }

  return res.json();
}

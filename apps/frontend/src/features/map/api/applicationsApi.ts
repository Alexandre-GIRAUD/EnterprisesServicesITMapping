import type { ApplicationRequest, ApplicationResponse } from '@/types/api';

function resolveUrl(pathWithQuery: string): string {
  const origin = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
    /\/$/,
    ''
  );
  return origin ? `${origin}${pathWithQuery}` : pathWithQuery;
}

/** Fetch all applications (optionally at point-in-time) for search/autocomplete. */
export async function fetchApplications(params?: {
  validAt?: string;
}): Promise<ApplicationResponse[]> {
  const search = params?.validAt ? `?validAt=${encodeURIComponent(params.validAt)}` : '';
  const url = resolveUrl(`/api/applications${search}`);
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Applications API ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 200)}` : ''}`
    );
  }

  return res.json();
}

export async function createApplication(payload: ApplicationRequest): Promise<ApplicationResponse> {
  const url = resolveUrl('/api/applications');
  const res = await fetch(url, {
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
      `Create application API ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 200)}` : ''}`
    );
  }

  return res.json();
}

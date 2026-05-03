import type {
  ApplicationRequest,
  ApplicationResponse,
  SuggestModulesFromGithubRequest,
  SuggestModulesFromGithubResponse,
} from '@/types/api';

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

export async function fetchApplicationById(applicationId: string): Promise<ApplicationResponse> {
  const url = resolveUrl(`/api/applications/${encodeURIComponent(applicationId)}`);
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Application API ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 200)}` : ''}`
    );
  }

  return res.json();
}

/**
 * Cascade-delete application (backend removes CONTAINS subtree Modules and DETACH DELETE the app node).
 */
export async function deleteApplicationById(applicationId: string): Promise<void> {
  const url = resolveUrl(`/api/applications/${encodeURIComponent(applicationId)}`);
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Delete application API ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 200)}` : ''}`
    );
  }
}

export async function suggestModulesFromGithub(
  applicationId: string,
  body?: SuggestModulesFromGithubRequest
): Promise<SuggestModulesFromGithubResponse> {
  const url = resolveUrl(
    `/api/applications/${encodeURIComponent(applicationId)}/modules/suggest-from-github`
  );
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Suggestion modules IA ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 240)}` : ''}`
    );
  }

  return res.json();
}

export async function updateApplicationById(
  applicationId: string,
  payload: ApplicationRequest
): Promise<ApplicationResponse> {
  const url = resolveUrl(`/api/applications/${encodeURIComponent(applicationId)}`);
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Update application API ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 200)}` : ''}`
    );
  }

  return res.json();
}

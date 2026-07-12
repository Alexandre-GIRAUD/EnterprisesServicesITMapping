import type {
  ApplicationRequest,
  ApplicationResponse,
  SuggestConnectionsFromGithubRequest,
  SuggestConnectionsFromGithubResponse,
  SuggestModulesFromGithubRequest,
  SuggestModulesFromGithubResponse,
} from '@/types/api';
import { authenticatedFetch, resolveApiUrl } from '@/config/api';

/** Fetch all applications for search/autocomplete. */
export async function fetchApplications(): Promise<ApplicationResponse[]> {
  const url = resolveApiUrl('/api/applications');
  const res = await authenticatedFetch(url, {
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
  const url = resolveApiUrl('/api/applications');
  const res = await authenticatedFetch(url, {
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
  const url = resolveApiUrl(`/api/applications/${encodeURIComponent(applicationId)}`);
  const res = await authenticatedFetch(url, {
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

export async function patchApplicationBusinessUnit(
  applicationId: string,
  businessUnitId: string | null
): Promise<ApplicationResponse> {
  const url = resolveApiUrl(
    `/api/applications/${encodeURIComponent(applicationId)}/business-unit`
  );
  const res = await authenticatedFetch(url, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ businessUnitId }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Business unit link ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 200)}` : ''}`
    );
  }

  return res.json();
}

export async function patchApplicationRegions(
  applicationId: string,
  regionCodes: string[]
): Promise<ApplicationResponse> {
  const url = resolveApiUrl(
    `/api/applications/${encodeURIComponent(applicationId)}/regions`
  );
  const res = await authenticatedFetch(url, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ regionCodes }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Regions link ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 200)}` : ''}`
    );
  }

  return res.json();
}

/**
 * Cascade-delete application (backend removes CONTAINS subtree Modules and DETACH DELETE the app node).
 */
export async function deleteApplicationById(applicationId: string): Promise<void> {
  const url = resolveApiUrl(`/api/applications/${encodeURIComponent(applicationId)}`);
  const res = await authenticatedFetch(url, {
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
  const url = resolveApiUrl(
    `/api/applications/${encodeURIComponent(applicationId)}/modules/suggest-from-github`
  );
  const res = await authenticatedFetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    if (res.status === 409) {
      const fallback =
        'Modules have already been suggested for this application.';
      let msg = fallback;
      try {
        const json = JSON.parse(detail) as { message?: string };
        if (json.message?.trim()) {
          msg = json.message.trim();
        }
      } catch {
        /* keep fallback */
      }
      throw new Error(msg);
    }
    throw new Error(
      `Suggestion modules IA ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 240)}` : ''}`
    );
  }

  return res.json();
}

/**
 * Infers application-to-application integration edges (outbound + inbound) from the linked GitHub
 * repository and persists them as DEPENDS_ON in Neo4j. Idempotent: re-runs skip duplicate edges.
 */
export async function suggestConnectionsFromGithub(
  applicationId: string,
  body?: SuggestConnectionsFromGithubRequest
): Promise<SuggestConnectionsFromGithubResponse> {
  const url = resolveApiUrl(
    `/api/applications/${encodeURIComponent(applicationId)}/connections/suggest-from-github`
  );
  const res = await authenticatedFetch(url, {
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
      `Suggestion connexions IA ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 240)}` : ''}`
    );
  }

  return res.json();
}

export async function updateApplicationById(
  applicationId: string,
  payload: ApplicationRequest
): Promise<ApplicationResponse> {
  const url = resolveApiUrl(`/api/applications/${encodeURIComponent(applicationId)}`);
  const res = await authenticatedFetch(url, {
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

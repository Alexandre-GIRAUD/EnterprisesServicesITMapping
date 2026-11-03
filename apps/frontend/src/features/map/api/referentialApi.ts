import { authenticatedFetch, resolveApiUrl } from '@/config/api';
import type {
  ReferentialIdentityDto,
  ReferentialMappingDto,
  ReferentialSyncResult,
  ReferentialView,
} from '@/types/api';

async function readError(response: Response, fallback: string): Promise<string> {
  const text = (await response.text().catch(() => '')).trim();
  if (!text) return fallback;
  try {
    const body = JSON.parse(text) as { detail?: string; message?: string };
    return body.detail || body.message || text;
  } catch {
    return text;
  }
}

async function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  const response = await authenticatedFetch(resolveApiUrl(path), {
    method,
    headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await readError(response, `${method} ${path} failed (${response.status})`));
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export function listReferentials(): Promise<ReferentialView[]> {
  return send('/api/referentials', 'GET');
}

export function createReferential(body: {
  name: string;
  urlTemplate: string;
  headerName: string;
}): Promise<ReferentialView> {
  return send('/api/referentials', 'POST', body);
}

export function updateReferential(
  id: string,
  body: { name: string; urlTemplate: string; headerName: string },
): Promise<ReferentialView> {
  return send(`/api/referentials/${id}`, 'PUT', body);
}

export function setReferentialSecret(id: string, secret: string): Promise<ReferentialView> {
  return send(`/api/referentials/${id}/secret`, 'PUT', { secret });
}

export function replaceReferentialIdentities(
  id: string,
  identities: ReferentialIdentityDto[],
): Promise<ReferentialView> {
  return send(`/api/referentials/${id}/identities`, 'PUT', { identities });
}

export function replaceReferentialMappings(
  id: string,
  mappings: ReferentialMappingDto[],
): Promise<ReferentialView> {
  return send(`/api/referentials/${id}/mappings`, 'PUT', { mappings });
}

export function bindReferentialAttribute(body: {
  fieldKey: string;
  referentialId: string | null;
  path: string;
}): Promise<ReferentialView[]> {
  return send('/api/referentials/bind', 'POST', body);
}

export function probeReferential(id: string, applicationId: string): Promise<{
  success: boolean;
  message: string;
  samplePreview: string;
}> {
  return send(`/api/referentials/${id}/probe`, 'POST', { applicationId });
}

export function proposeReferentialMappings(id: string): Promise<ReferentialMappingDto[]> {
  return send(`/api/referentials/${id}/propose`, 'POST');
}

export function syncReferential(id: string, applicationId?: string): Promise<ReferentialSyncResult> {
  return send(`/api/referentials/${id}/sync`, 'POST', { applicationId: applicationId ?? null });
}

export function deleteReferential(id: string): Promise<void> {
  return send(`/api/referentials/${id}`, 'DELETE');
}

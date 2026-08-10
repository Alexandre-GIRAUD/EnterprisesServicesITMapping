import { authenticatedFetch, resolveApiUrl } from '@/config/api';
import type { DataModelPutRequest, DataModelResponse } from '@/types/api';

export async function getDataModelRequest(): Promise<DataModelResponse> {
  const res = await authenticatedFetch(resolveApiUrl('/api/data-model'), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`GET data-model failed (${res.status})`);
  }
  return res.json() as Promise<DataModelResponse>;
}

export async function putDataModelRequest(body: DataModelPutRequest): Promise<DataModelResponse> {
  const res = await authenticatedFetch(resolveApiUrl('/api/data-model'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = (await res.text().catch(() => '')).trim();
    if (res.status === 403) {
      throw new Error(
        text ||
          'PUT data-model failed (403): admin role required. Log out and sign in again as admin so the JWT includes ROLE_ADMIN.'
      );
    }
    throw new Error(text || `PUT data-model failed (${res.status})`);
  }
  return res.json() as Promise<DataModelResponse>;
}

export async function getDataModelPromptPreviewRequest(): Promise<string> {
  const res = await authenticatedFetch(resolveApiUrl('/api/data-model/prompt-preview'), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`GET prompt-preview failed (${res.status})`);
  }
  const json = (await res.json()) as { promptSection: string };
  return json.promptSection ?? '';
}

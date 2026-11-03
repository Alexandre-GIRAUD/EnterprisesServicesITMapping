import { authenticatedFetch, resolveApiUrl } from '@/config/api';
import type {
  DataSourceDto,
  DataSourceRequest,
  SourceMappingAlertDto,
  SourceMappingEntryDto,
  SourceNameDto,
  SourceMappingResponse,
  SourceSyncResponse,
} from '@/types/api';

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authenticatedFetch(resolveApiUrl(`/api/sources${path}`), {
    ...init,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const text = (await res.text().catch(() => '')).trim();
    throw new Error(text || `Sources request failed (${res.status})`);
  }
  const body = await res.text();
  return (body ? JSON.parse(body) : undefined) as T;
}

const send = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const listSourceNames = () => call<SourceNameDto[]>('/names');
export const listSources = () => call<DataSourceDto[]>('');
export const createSource = (body: DataSourceRequest) => call<DataSourceDto>('', send('POST', body));
export const updateSource = (id: string, body: DataSourceRequest) =>
  call<DataSourceDto>(`/${id}`, send('PUT', body));
export const deleteSource = (id: string) => call<void>(`/${id}`, send('DELETE'));
export const previewSource = (id: string) =>
  call<{ columns: string[]; rowCount: number }>(`/${id}/preview`, send('POST'));
export const getSourceMapping = (id: string) => call<SourceMappingResponse>(`/${id}/mapping`);
export const saveSourceMapping = (id: string, entries: SourceMappingEntryDto[]) =>
  call<SourceSyncResponse>(`/${id}/mapping`, send('PUT', { entries }));
export const syncSource = (id: string) => call<SourceSyncResponse>(`/${id}/sync`, send('POST'));
export const listSourceAlerts = () => call<SourceMappingAlertDto[]>('/alerts');

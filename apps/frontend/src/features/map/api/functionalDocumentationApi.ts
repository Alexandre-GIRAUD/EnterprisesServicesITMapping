import type {
  FunctionalDocumentationDto,
} from '@/types/api';
import { authenticatedFetch, resolveApiUrl } from '@/config/api';

async function readError(res: Response, label: string): Promise<never> {
  const detail = await res.text().catch(() => '');
  throw new Error(
    `${label} ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 200)}` : ''}`
  );
}

export async function fetchFunctionalDocumentation(
  applicationId: string
): Promise<FunctionalDocumentationDto> {
  const url = resolveApiUrl(
    `/api/applications/${encodeURIComponent(applicationId)}/functional-documentation`
  );
  const res = await authenticatedFetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) await readError(res, 'Functional documentation API');
  return res.json();
}

/** Starts async generation (HTTP 202). Poll GET until READY/FAILED. */
export async function generateFunctionalDocumentation(
  applicationId: string
): Promise<FunctionalDocumentationDto> {
  const url = resolveApiUrl(
    `/api/applications/${encodeURIComponent(applicationId)}/functional-documentation/generate`
  );
  const res = await authenticatedFetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) await readError(res, 'Generate functional documentation API');
  return res.json();
}

import type { AuditTargetType } from '@/types/api';
import { authenticatedFetch, resolveApiUrl } from '@/config/api';

export type EntityValidation = {
  username: string;
  validatedAt: string;
};

async function readError(res: Response, label: string): Promise<never> {
  const detail = await res.text().catch(() => '');
  throw new Error(
    `${label} ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 200)}` : ''}`
  );
}

export async function fetchEntityValidation(
  targetType: AuditTargetType,
  targetId: string
): Promise<EntityValidation | null> {
  const params = new URLSearchParams({ targetType, targetId });
  const url = resolveApiUrl(`/api/audit/validations?${params}`);
  const res = await authenticatedFetch(url, { headers: { Accept: 'application/json' } });
  if (res.status === 204) return null;
  if (!res.ok) await readError(res, 'Validation API');
  return res.json();
}

export async function confirmEntityValidation(
  targetType: AuditTargetType,
  targetId: string
): Promise<EntityValidation> {
  const url = resolveApiUrl('/api/audit/validations');
  const res = await authenticatedFetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetType, targetId }),
  });
  if (!res.ok) await readError(res, 'Validation API');
  return res.json();
}

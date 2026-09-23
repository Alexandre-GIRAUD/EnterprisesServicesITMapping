import type {
  AttributeChangeMeta,
  AttributeChangePageDto,
  AuditTargetType,
} from '@/types/api';
import { authenticatedFetch, resolveApiUrl } from '@/config/api';

async function readError(res: Response, label: string): Promise<never> {
  const detail = await res.text().catch(() => '');
  throw new Error(
    `${label} ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 200)}` : ''}`
  );
}

export async function fetchAttributeHistory(
  targetType: AuditTargetType,
  targetId: string,
  page = 0,
  size = 20,
  fieldKey?: string
): Promise<AttributeChangePageDto> {
  const params = new URLSearchParams({
    targetType,
    targetId,
    page: String(page),
    size: String(size),
  });
  if (fieldKey) params.set('fieldKey', fieldKey);
  const url = resolveApiUrl(`/api/audit/attributes?${params}`);
  const res = await authenticatedFetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) await readError(res, 'Attribute history API');
  return res.json();
}

export const HUMAN_CHANGE_REASON_OPTIONS: Array<{
  value: AttributeChangeMeta['reason'];
  label: string;
}> = [
  { value: 'MissedOnScan', label: 'Missed on Scan' },
  { value: 'NotInSources', label: 'Not in Sources' },
  { value: 'WrongData', label: 'Wrong Data' },
  { value: 'WrongFormat', label: 'Wrong Format' },
  { value: 'WrongSpelling', label: 'Wrong Spelling' },
  { value: 'OutdatedData', label: 'Outdated Data' },
  { value: 'Others', label: 'Others' },
];

export const HUMAN_REASON_LABEL: Record<AttributeChangeMeta['reason'], string> = Object.fromEntries(
  HUMAN_CHANGE_REASON_OPTIONS.map((o) => [o.value, o.label])
) as Record<AttributeChangeMeta['reason'], string>;

export const REASON_COMMENT_MAX = 1000;

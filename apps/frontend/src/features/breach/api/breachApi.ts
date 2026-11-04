import { authenticatedFetch, resolveApiUrl } from '@/config/api';
import type {
  BreachImpactResponseDto,
  BreachResultDto,
  BreachRuleDto,
  BreachRuleRequest,
  BreachSummaryDto,
} from '@/types/api';

const RULES_PATH = '/api/breach-rules';
const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };

async function readJson<T>(res: Response, action: string): Promise<T> {
  if (!res.ok) {
    const text = (await res.text().catch(() => '')).trim();
    throw new Error(serverMessage(text) || `${action} failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

/** Spring error bodies carry the reason in `message`; plain text is shown as is. */
function serverMessage(text: string): string {
  try {
    const body = JSON.parse(text) as { message?: string };
    return body.message ?? '';
  } catch {
    return text;
  }
}

export async function listBreachRules(): Promise<BreachRuleDto[]> {
  const res = await authenticatedFetch(resolveApiUrl(RULES_PATH), { headers: { Accept: 'application/json' } });
  return readJson(res, 'Loading the breach rules');
}

export async function saveBreachRule(rule: BreachRuleRequest, id: string | null): Promise<BreachRuleDto> {
  const res = await authenticatedFetch(resolveApiUrl(id ? `${RULES_PATH}/${id}` : RULES_PATH), {
    method: id ? 'PUT' : 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(rule),
  });
  return readJson(res, 'Saving the rule');
}

export async function deleteBreachRule(id: string): Promise<void> {
  const res = await authenticatedFetch(resolveApiUrl(`${RULES_PATH}/${id}`), { method: 'DELETE' });
  if (!res.ok) throw new Error(`Deleting the rule failed (${res.status})`);
}

export async function evaluateBreachRule(id: string): Promise<BreachResultDto> {
  const res = await authenticatedFetch(resolveApiUrl(`${RULES_PATH}/${id}/evaluation`), {
    headers: { Accept: 'application/json' },
  });
  return readJson(res, 'Evaluating the rule');
}

export async function getBreachSummary(): Promise<BreachSummaryDto> {
  const res = await authenticatedFetch(resolveApiUrl(`${RULES_PATH}/evaluation`), {
    headers: { Accept: 'application/json' },
  });
  return readJson(res, 'Loading the breaches');
}

export async function getBreachImpact(runId: string, itemId: string): Promise<BreachImpactResponseDto> {
  const res = await authenticatedFetch(
    resolveApiUrl(`/api/change-detections/${runId}/items/${itemId}/breach-impact`),
    { headers: { Accept: 'application/json' } }
  );
  return readJson(res, 'Loading the breach impact');
}

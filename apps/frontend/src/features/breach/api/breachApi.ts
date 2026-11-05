import { authenticatedFetch, resolveApiUrl } from '@/config/api';
import type {
  BreachImpactResponseDto,
  BreachResultDto,
  BreachRuleDto,
  BreachRuleRequest,
  BreachSummaryDto,
} from '@/types/api';

const RULES_PATH = '/api/breach-rules';
const CHANGE_DETECTIONS_PATH = '/api/change-detections';
const JSON_TYPE = 'application/json';
const ACCEPT_JSON = { Accept: JSON_TYPE };
const SEND_JSON = { 'Content-Type': JSON_TYPE, Accept: JSON_TYPE };

async function readJson<T>(response: Response, action: string): Promise<T> {
  if (!response.ok) {
    const body = (await response.text().catch(() => '')).trim();
    throw new Error(readServerMessage(body) || `${action} failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

/** Spring error bodies carry the reason in `message`; a body that is not JSON is shown as is. */
function readServerMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { message?: string };
    return parsed.message ?? '';
  } catch {
    return body;
  }
}

async function getJson<T>(path: string, action: string): Promise<T> {
  const response = await authenticatedFetch(resolveApiUrl(path), { headers: ACCEPT_JSON });
  return readJson(response, action);
}

export function listBreachRules(): Promise<BreachRuleDto[]> {
  return getJson(RULES_PATH, 'Loading the breach rules');
}

export async function saveBreachRule(rule: BreachRuleRequest, id: string | null): Promise<BreachRuleDto> {
  const response = await authenticatedFetch(resolveApiUrl(id ? `${RULES_PATH}/${id}` : RULES_PATH), {
    method: id ? 'PUT' : 'POST',
    headers: SEND_JSON,
    body: JSON.stringify(rule),
  });
  return readJson(response, 'Saving the rule');
}

export async function deleteBreachRule(id: string): Promise<void> {
  const response = await authenticatedFetch(resolveApiUrl(`${RULES_PATH}/${id}`), { method: 'DELETE' });
  if (!response.ok) throw new Error(`Deleting the rule failed (${response.status})`);
}

export function evaluateBreachRule(id: string): Promise<BreachResultDto> {
  return getJson(`${RULES_PATH}/${id}/evaluation`, 'Evaluating the rule');
}

export function getBreachSummary(): Promise<BreachSummaryDto> {
  return getJson(`${RULES_PATH}/evaluation`, 'Loading the breaches');
}

export function getBreachImpact(runId: string, itemId: string): Promise<BreachImpactResponseDto> {
  return getJson(`${CHANGE_DETECTIONS_PATH}/${runId}/items/${itemId}/breach-impact`, 'Loading the breach impact');
}

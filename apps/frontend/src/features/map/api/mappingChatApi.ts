import { authenticatedFetch, resolveApiUrl } from '@/config/api';
import type { ChatAskResponseDto, ChatHistoryMessageDto, GraphFilters } from '@/types/api';

export async function askMappingChat(
  message: string,
  history?: ChatHistoryMessageDto[],
  filters?: GraphFilters
): Promise<ChatAskResponseDto> {
  const body: { message: string; messages?: ChatHistoryMessageDto[]; filters?: GraphFilters } = {
    message,
  };
  if (history && history.length > 0) {
    body.messages = history;
  }
  if (filters) {
    body.filters = filters;
  }
  const res = await authenticatedFetch(resolveApiUrl('/api/chat/ask'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Chat API ${res.status}${detail ? `: ${detail.slice(0, 240)}` : ''}`
    );
  }
  return res.json();
}

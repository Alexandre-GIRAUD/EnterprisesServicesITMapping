import type {
  CommentDto,
  CommentPageDto,
  CommentTargetType,
  CreateCommentRequest,
  UpdateCommentRequest,
} from '@/types/api';
import { authenticatedFetch, resolveApiUrl } from '@/config/api';

const MAX_BODY = 2000;

async function readError(res: Response, label: string): Promise<never> {
  const detail = await res.text().catch(() => '');
  throw new Error(
    `${label} ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 200)}` : ''}`
  );
}

export async function fetchComments(
  targetType: CommentTargetType,
  targetId: string,
  page = 0,
  size = 20
): Promise<CommentPageDto> {
  const params = new URLSearchParams({
    targetType,
    targetId,
    page: String(page),
    size: String(size),
  });
  const url = resolveApiUrl(`/api/comments?${params}`);
  const res = await authenticatedFetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) await readError(res, 'Comments API');
  return res.json();
}

export async function createComment(payload: CreateCommentRequest): Promise<CommentDto> {
  const url = resolveApiUrl('/api/comments');
  const res = await authenticatedFetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) await readError(res, 'Create comment API');
  return res.json();
}

export async function updateComment(id: string, payload: UpdateCommentRequest): Promise<CommentDto> {
  const url = resolveApiUrl(`/api/comments/${encodeURIComponent(id)}`);
  const res = await authenticatedFetch(url, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) await readError(res, 'Update comment API');
  return res.json();
}

export async function deleteComment(id: string): Promise<void> {
  const url = resolveApiUrl(`/api/comments/${encodeURIComponent(id)}`);
  const res = await authenticatedFetch(url, { method: 'DELETE' });
  if (!res.ok) await readError(res, 'Delete comment API');
}

export function clampCommentBody(body: string): string {
  return body.trim().slice(0, MAX_BODY);
}

export const COMMENT_MAX_BODY = MAX_BODY;

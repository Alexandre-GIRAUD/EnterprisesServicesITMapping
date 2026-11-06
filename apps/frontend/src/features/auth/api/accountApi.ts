import { authenticatedFetch, resolveApiUrl, type LoginResponseDto } from '@/config/api';
import { JSON_HEADERS, readFailureMessage } from '@/features/auth/api/apiResponses';

/** `email` is null for accounts created before emails were stored. */
export type AccountDto = { username: string; email: string | null };


export async function fetchAccountRequest(): Promise<AccountDto> {
  const res = await authenticatedFetch(resolveApiUrl('/api/account'), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Could not load your account (${res.status}).`);
  }
  return res.json() as Promise<AccountDto>;
}

export async function requestEmailChange(email: string): Promise<void> {
  const res = await authenticatedFetch(resolveApiUrl('/api/account/email'), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    throw new Error(await readFailureMessage(res, 'Could not change the email'));
  }
}

export async function confirmEmailChangeRequest(token: string): Promise<LoginResponseDto> {
  const res = await fetch(resolveApiUrl('/api/auth/confirm-email-change'), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    throw new Error(await readFailureMessage(res, 'Could not confirm the new email'));
  }
  return res.json() as Promise<LoginResponseDto>;
}

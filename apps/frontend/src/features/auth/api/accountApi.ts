import { authenticatedFetch, resolveApiUrl, type LoginResponseDto } from '@/config/api';

/** `email` is null for accounts created before emails were stored. */
export type AccountDto = { username: string; email: string | null };

const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' };

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
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message || `Could not change the email (${res.status}).`);
  }
}

export async function confirmEmailChangeRequest(token: string): Promise<LoginResponseDto> {
  const res = await fetch(resolveApiUrl('/api/auth/confirm-email-change'), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(
      body?.message || 'This link is invalid or has expired. Ask for a new one in Settings.',
    );
  }
  return res.json() as Promise<LoginResponseDto>;
}

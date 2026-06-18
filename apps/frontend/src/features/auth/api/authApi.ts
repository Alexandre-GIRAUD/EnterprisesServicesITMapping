import {
  authenticatedFetch,
  resolveApiUrl,
  type LoginResponseDto,
} from '@/config/api';

export type UserSummaryDto = {
  id: string;
  username: string;
  role: string;
  createdAt: string;
};

export async function loginRequest(username: string, password: string): Promise<LoginResponseDto> {
  const res = await fetch(resolveApiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      detail
        ? `Unable to sign in (${res.status}): ${detail.slice(0, 200)}`
        : `Unable to sign in (${res.status})`
    );
  }
  return res.json() as Promise<LoginResponseDto>;
}

export async function listUsersRequest(): Promise<UserSummaryDto[]> {
  const res = await authenticatedFetch(resolveApiUrl('/api/admin/users'), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `User list ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`
    );
  }
  return res.json();
}

export async function createUserRequest(username: string, password: string): Promise<UserSummaryDto> {
  const res = await authenticatedFetch(resolveApiUrl('/api/admin/users'), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const text = await res.text().catch(() => '');
  if (res.status === 409) {
    throw new Error('That username already exists.');
  }
  if (!res.ok) {
    throw new Error(
      `User creation ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`
    );
  }
  try {
    return JSON.parse(text) as UserSummaryDto;
  } catch {
    throw new Error('Invalid server response after creation.');
  }
}

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

const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' };

/** Sign-in refused because the account's email is not confirmed yet. */
export class EmailNotVerifiedError extends Error {
  constructor() {
    super('Confirm your email address before signing in.');
    this.name = 'EmailNotVerifiedError';
  }
}

export type PublicConfigDto = { signupEnabled: boolean };

export async function fetchPublicConfig(): Promise<PublicConfigDto> {
  const res = await fetch(resolveApiUrl('/api/config'), { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    return { signupEnabled: false };
  }
  return res.json() as Promise<PublicConfigDto>;
}

export async function loginRequest(username: string, password: string): Promise<LoginResponseDto> {
  const res = await fetch(resolveApiUrl('/api/auth/login'), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ username, password }),
  });
  if (res.status === 403) {
    throw new EmailNotVerifiedError();
  }
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

export async function signupRequest(
  email: string,
  password: string,
  workspaceName: string,
): Promise<{ email: string }> {
  const res = await fetch(resolveApiUrl('/api/auth/signup'), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ email, password, workspaceName }),
  });
  if (res.ok) {
    return res.json() as Promise<{ email: string }>;
  }
  throw new Error(await signupFailureMessage(res));
}

export async function verifyEmailRequest(token: string): Promise<LoginResponseDto> {
  const res = await fetch(resolveApiUrl('/api/auth/verify-email'), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    throw new Error('This link is invalid or has expired. Sign in to get a new one.');
  }
  return res.json() as Promise<LoginResponseDto>;
}

export async function resendVerificationRequest(email: string): Promise<void> {
  const res = await fetch(resolveApiUrl('/api/auth/resend-verification'), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    throw new Error(`Could not resend the email (${res.status}).`);
  }
}

async function signupFailureMessage(res: Response): Promise<string> {
  if (res.status === 409) {
    return 'An account already uses this email. Sign in instead.';
  }
  if (res.status === 429) {
    return 'Too many signups from this network. Try again in an hour.';
  }
  if (res.status === 400) {
    return 'Check the form: a valid email, a password of at least 8 characters and a workspace name.';
  }
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return body?.message ?? `Signup failed (${res.status}).`;
}

/**
 * API and auth configuration.
 * JWT is stored in sessionStorage for the SPA session.
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

/** Build full URL for API calls (Vite proxy `/api` or absolute backend origin). */
export function resolveApiUrl(pathWithQuery: string): string {
  const origin = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '');
  return origin ? `${origin}${pathWithQuery}` : pathWithQuery;
}

const TOKEN_KEY = 'itmapping.jwt';
const ROLES_KEY = 'itmapping.roles';
const USER_KEY = 'itmapping.username';

export type LoginResponseDto = {
  token: string;
  username: string;
  roles: string[];
};

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getStoredUsername(): string | null {
  return sessionStorage.getItem(USER_KEY);
}

export function getStoredRoles(): string[] {
  const raw = sessionStorage.getItem(ROLES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function setSession(login: LoginResponseDto): void {
  sessionStorage.setItem(TOKEN_KEY, login.token);
  sessionStorage.setItem(USER_KEY, login.username);
  sessionStorage.setItem(ROLES_KEY, JSON.stringify(login.roles));
}

export function clearSession(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(ROLES_KEY);
}

export function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {};
  const t = getToken();
  if (t) {
    headers.Authorization = `Bearer ${t}`;
  }
  return headers;
}

/** Same-origin or VITE_API_BASE_URL fetch with JWT attached when present. */
export function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers ?? undefined);
  const t = getToken();
  if (t) {
    headers.set('Authorization', `Bearer ${t}`);
  }
  return fetch(input, { ...init, headers });
}

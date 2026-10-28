/**
 * API and auth configuration.
 * JWT is stored in sessionStorage for the SPA session.
 */

// Self-checks load this module outside Vite, where import.meta.env is absent.
export const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL ?? '';

/** Build full URL for API calls (Vite proxy `/api` or absolute backend origin). */
export function resolveApiUrl(pathWithQuery: string): string {
  const origin = (import.meta.env?.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '');
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

const AS_OF_PARAM = 'asOf';
/** Reads answered from the Production graph, which the backend can replay as of a past day. */
const PAST_READ_PATH = /\/api\/(graph|applications)(\/|\?|$)/;

let viewingDay: string | null = null;

/** Past day shown on Cartography (YYYY-MM-DD), or null for today. */
export function setViewingDay(day: string | null): void {
  viewingDay = day;
}

/** Adds asOf to graph and application GETs; writes and other endpoints stay live. */
export function pastReadUrl(url: string, method: string, day: string | null): string {
  if (!day || method.toUpperCase() !== 'GET' || !PAST_READ_PATH.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}${AS_OF_PARAM}=${encodeURIComponent(day)}`;
}

/** Same-origin or VITE_API_BASE_URL fetch with JWT attached when present. */
export function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers ?? undefined);
  const t = getToken();
  if (t) {
    headers.set('Authorization', `Bearer ${t}`);
  }
  const url = typeof input === 'string' ? pastReadUrl(input, init?.method ?? 'GET', viewingDay) : input;
  return fetch(url, { ...init, headers });
}

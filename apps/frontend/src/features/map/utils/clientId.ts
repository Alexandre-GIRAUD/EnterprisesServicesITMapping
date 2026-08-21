/**
 * UUID for client-only ids. Falls back when crypto.randomUUID is unavailable
 * (e.g. http://public-ip — not a secure context).
 */
export function createClientUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

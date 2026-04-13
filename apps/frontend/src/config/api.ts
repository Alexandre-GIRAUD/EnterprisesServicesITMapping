/**
 * API and auth configuration.
 * JWT: when implemented, attach token via interceptor or fetch wrapper.
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  // When JWT is implemented: headers['Authorization'] = `Bearer ${getToken()}`;
  return headers;
}

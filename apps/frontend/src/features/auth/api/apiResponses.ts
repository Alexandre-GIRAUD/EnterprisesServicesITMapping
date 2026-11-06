export const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' };

/** The backend's own message when it gives one, else `fallback (status).` */
export async function readFailureMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return body?.message || `${fallback} (${res.status}).`;
}

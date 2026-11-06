import { authenticatedFetch, resolveApiUrl, type LoginResponseDto } from '@/config/api';

export type InvitationRole = 'USER' | 'ADMIN';
export type InvitationStatus = 'INVITED' | 'EXPIRED';

export type InvitationDto = {
  id: string;
  email: string;
  role: InvitationRole;
  status: InvitationStatus;
  expiresAt: string;
};

const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' };
const INVITATIONS_PATH = '/api/admin/invitations';

export async function listInvitationsRequest(): Promise<InvitationDto[]> {
  const res = await authenticatedFetch(resolveApiUrl(INVITATIONS_PATH), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Could not load the invitations (${res.status}).`);
  }
  return res.json() as Promise<InvitationDto[]>;
}

export async function inviteRequest(email: string, role: InvitationRole): Promise<InvitationDto> {
  const res = await authenticatedFetch(resolveApiUrl(INVITATIONS_PATH), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ email, role }),
  });
  if (!res.ok) {
    throw new Error(await describeFailure(res, 'Could not send the invitation'));
  }
  return res.json() as Promise<InvitationDto>;
}

export async function resendInvitationRequest(id: string): Promise<void> {
  const res = await authenticatedFetch(resolveApiUrl(`${INVITATIONS_PATH}/${id}/resend`), {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(await describeFailure(res, 'Could not resend the invitation'));
  }
}

export async function cancelInvitationRequest(id: string): Promise<void> {
  const res = await authenticatedFetch(resolveApiUrl(`${INVITATIONS_PATH}/${id}`), {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(await describeFailure(res, 'Could not cancel the invitation'));
  }
}

export async function acceptInvitationRequest(
  token: string,
  password: string,
): Promise<LoginResponseDto> {
  const res = await fetch(resolveApiUrl('/api/auth/accept-invitation'), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ token, password }),
  });
  if (!res.ok) {
    throw new Error(await describeFailure(res, 'Could not accept the invitation'));
  }
  return res.json() as Promise<LoginResponseDto>;
}

/** The backend's own message when it gives one, else a generic line with the status. */
async function describeFailure(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return body?.message || `${fallback} (${res.status}).`;
}

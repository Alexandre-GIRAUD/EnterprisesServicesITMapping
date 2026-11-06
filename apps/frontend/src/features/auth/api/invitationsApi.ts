import { authenticatedFetch, resolveApiUrl, type LoginResponseDto } from '@/config/api';
import { JSON_HEADERS, readFailureMessage } from '@/features/auth/api/apiResponses';

export type InvitationRole = 'USER' | 'ADMIN';
export type InvitationStatus = 'INVITED' | 'EXPIRED';

export type InvitationDto = {
  id: string;
  email: string;
  role: InvitationRole;
  status: InvitationStatus;
  expiresAt: string;
};

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
    throw new Error(await readFailureMessage(res, 'Could not send the invitation'));
  }
  return res.json() as Promise<InvitationDto>;
}

export async function resendInvitationRequest(id: string): Promise<void> {
  const res = await authenticatedFetch(resolveApiUrl(`${INVITATIONS_PATH}/${id}/resend`), {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(await readFailureMessage(res, 'Could not resend the invitation'));
  }
}

export async function cancelInvitationRequest(id: string): Promise<void> {
  const res = await authenticatedFetch(resolveApiUrl(`${INVITATIONS_PATH}/${id}`), {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(await readFailureMessage(res, 'Could not cancel the invitation'));
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
    throw new Error(await readFailureMessage(res, 'Could not accept the invitation'));
  }
  return res.json() as Promise<LoginResponseDto>;
}

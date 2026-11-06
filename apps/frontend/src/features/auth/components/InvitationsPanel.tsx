import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  cancelInvitationRequest,
  inviteRequest,
  listInvitationsRequest,
  resendInvitationRequest,
  type InvitationDto,
  type InvitationRole,
} from '@/features/auth/api/invitationsApi';

const STATUS_LABELS: Record<InvitationDto['status'], string> = {
  INVITED: 'Invited',
  EXPIRED: 'Expired',
};

/** Invite by email and follow pending invitations. Shown when the server can send mail. */
export function InvitationsPanel() {
  const [invitations, setInvitations] = useState<InvitationDto[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitationRole>('USER');
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setInvitations(await listInvitationsRequest());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not load the invitations.');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function runAction(action: () => Promise<unknown>, successMessage: string) {
    setError(null);
    setMessage(null);
    setIsBusy(true);
    try {
      await action();
      setMessage(successMessage);
      await reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Something went wrong.');
    } finally {
      setIsBusy(false);
    }
  }

  async function onInvite(event: FormEvent) {
    event.preventDefault();
    const invitee = email.trim();
    await runAction(async () => {
      await inviteRequest(invitee, role);
      setEmail('');
    }, `Invitation sent to ${invitee}.`);
  }

  return (
    <section className="admin-users-panel">
      <h2>Invite by email</h2>
      <form className="auth-form" onSubmit={onInvite}>
        <label className="auth-label">
          Email
          <input
            className="auth-input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="auth-label">
          Role
          <select
            className="auth-input"
            value={role}
            onChange={(event) => setRole(event.target.value as InvitationRole)}
          >
            <option value="USER">User</option>
            <option value="ADMIN">Admin</option>
          </select>
        </label>
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="auth-success" role="status">
            {message}
          </p>
        ) : null}
        <button type="submit" className="auth-submit" disabled={isBusy}>
          {isBusy ? 'Sending…' : 'Send invitation'}
        </button>
      </form>
      {invitations.length > 0 ? (
        <ul className="admin-users-list">
          {invitations.map((invitation) => (
            <li key={invitation.id}>
              <span className="admin-users-name">{invitation.email}</span>
              <span className="admin-users-role">
                {invitation.role} · {STATUS_LABELS[invitation.status]}
              </span>
              <button
                type="button"
                className="auth-link"
                disabled={isBusy}
                onClick={() =>
                  runAction(
                    () => resendInvitationRequest(invitation.id),
                    `Invitation sent again to ${invitation.email}.`,
                  )
                }
              >
                Resend
              </button>
              <button
                type="button"
                className="auth-link"
                disabled={isBusy}
                onClick={() =>
                  runAction(
                    () => cancelInvitationRequest(invitation.id),
                    `Invitation to ${invitation.email} cancelled.`,
                  )
                }
              >
                Cancel
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

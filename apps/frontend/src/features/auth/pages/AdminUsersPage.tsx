import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/AuthContext';
import { createUserRequest, listUsersRequest, type UserSummaryDto } from '@/features/auth/api/authApi';

export function AdminUsersPage() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserSummaryDto[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await listUsersRequest();
        if (!cancelled) setUsers(list);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Unable to load.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">Access denied</h1>
          <p className="auth-subtitle">This page is restricted to administrators.</p>
          <Link to="/map" className="auth-link">
            Back to map
          </Link>
        </div>
      </div>
    );
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreateMessage(null);
    setCreateBusy(true);
    try {
      await createUserRequest(newUsername.trim(), newPassword);
      setCreateMessage('User created.');
      setNewUsername('');
      setNewPassword('');
      const list = await listUsersRequest();
      setUsers(list);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Unable to create.');
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <div className="admin-users-page">
      <div className="admin-users-header">
        <h1>Users</h1>
        <p className="admin-users-lead">Create accounts (standard user role).</p>
      </div>

      <section className="admin-users-panel">
        <h2>New user</h2>
        <form className="auth-form" onSubmit={onCreate}>
          <label className="auth-label">
            Username
            <input
              className="auth-input"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              required
              minLength={2}
              maxLength={64}
            />
          </label>
          <label className="auth-label">
            Password (min. 8 characters)
            <input
              className="auth-input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              maxLength={128}
            />
          </label>
          {createError ? (
            <p className="auth-error" role="alert">
              {createError}
            </p>
          ) : null}
          {createMessage ? (
            <p className="auth-success" role="status">
              {createMessage}
            </p>
          ) : null}
          <button type="submit" className="auth-submit" disabled={createBusy}>
            {createBusy ? 'Creating…' : 'Create account'}
          </button>
        </form>
      </section>

      <section className="admin-users-panel">
        <h2>List</h2>
        {loadError ? (
          <p className="auth-error">{loadError}</p>
        ) : (
          <ul className="admin-users-list">
            {users.map((u) => (
              <li key={u.id}>
                <span className="admin-users-name">{u.username}</span>
                <span className="admin-users-role">{u.role}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

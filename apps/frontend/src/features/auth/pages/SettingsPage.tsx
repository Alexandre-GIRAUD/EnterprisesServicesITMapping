import { useAuth } from '@/features/auth/context/AuthContext';
import { AdminUsersPage } from '@/features/auth/pages/AdminUsersPage';
import { GitHubTokenSettings } from '@/features/auth/pages/GitHubTokenSettings';

export function SettingsPage() {
  const { isAdmin } = useAuth();

  return (
    <div className="admin-users-page">
      <div className="admin-users-header">
        <h1>Settings</h1>
      </div>
      <GitHubTokenSettings />
      {isAdmin ? <AdminUsersPage embedded /> : null}
    </div>
  );
}

import { useAuth } from '@/features/auth/context/AuthContext';
import { AdminUsersPage } from '@/features/auth/pages/AdminUsersPage';
import { BitbucketTokenSettings } from '@/features/auth/pages/BitbucketTokenSettings';
import { GitHubTokenSettings } from '@/features/auth/pages/GitHubTokenSettings';
import { JiraTokenSettings } from '@/features/auth/pages/JiraTokenSettings';

export function SettingsPage() {
  const { isAdmin } = useAuth();

  return (
    <div className="admin-users-page">
      <div className="admin-users-header">
        <h1>Settings</h1>
      </div>
      <GitHubTokenSettings />
      <BitbucketTokenSettings />
      <JiraTokenSettings />
      {isAdmin ? <AdminUsersPage embedded /> : null}
    </div>
  );
}

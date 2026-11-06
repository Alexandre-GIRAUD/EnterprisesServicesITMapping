import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/layouts/Layout';
import { MapPage } from '@/features/map/pages/MapPage';
import { GitHubImportPage } from '@/features/map/pages/GitHubImportPage';
import { ApplicationModuleMapPage } from '@/features/map/pages/ApplicationModuleMapPage';
import { ChangesListPage } from '@/features/map/pages/ChangesListPage';
import { ChangeDetailPage } from '@/features/map/pages/ChangeDetailPage';
import { OverrideConflictDetailPage } from '@/features/map/pages/OverrideConflictDetailPage';
import { AuthProvider } from '@/features/auth/context/AuthContext';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { AcceptInvitationPage } from '@/features/auth/pages/AcceptInvitationPage';
import { ConfirmEmailPage } from '@/features/auth/pages/ConfirmEmailPage';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage';
import { SignupPage } from '@/features/auth/pages/SignupPage';
import { VerifyEmailPage } from '@/features/auth/pages/VerifyEmailPage';
import { AdminUsersPage } from '@/features/auth/pages/AdminUsersPage';
import { SettingsPage } from '@/features/auth/pages/SettingsPage';
import { DataModelPage } from '@/features/datamodel/pages/DataModelPage';
import { BreachPage } from '@/features/breach/pages/BreachPage';
import { AboutPage } from '@/features/about/AboutPage';
import { ChatPage } from '@/features/chat/ChatPage';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
        <Route path="/confirm-email" element={<ConfirmEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/map" replace />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/map/import-github" element={<GitHubImportPage />} />
            <Route path="/map/apps/:applicationId" element={<ApplicationModuleMapPage />} />
            <Route path="/data-model" element={<DataModelPage />} />
            <Route path="/breaches" element={<BreachPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/admin/changes" element={<ChangesListPage />} />
            <Route
              path="/admin/changes/overrides/:conflictId"
              element={<OverrideConflictDetailPage />}
            />
            <Route path="/admin/changes/:runId/:itemId" element={<ChangeDetailPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="*" element={<Navigate to="/map" replace />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;

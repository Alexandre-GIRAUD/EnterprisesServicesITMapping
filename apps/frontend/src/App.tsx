import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/layouts/Layout';
import { MapPage } from '@/features/map/pages/MapPage';
import { GitHubImportPage } from '@/features/map/pages/GitHubImportPage';
import { ApplicationModuleMapPage } from '@/features/map/pages/ApplicationModuleMapPage';
import { AuthProvider } from '@/features/auth/context/AuthContext';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { AdminUsersPage } from '@/features/auth/pages/AdminUsersPage';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/map" replace />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/map/import-github" element={<GitHubImportPage />} />
            <Route path="/map/apps/:applicationId" element={<ApplicationModuleMapPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="*" element={<Navigate to="/map" replace />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;

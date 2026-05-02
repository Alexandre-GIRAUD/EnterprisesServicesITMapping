import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/layouts/Layout';
import { MapPage } from '@/features/map/pages/MapPage';
import { GitHubImportPage } from '@/features/map/pages/GitHubImportPage';
import { ApplicationModuleMapPage } from '@/features/map/pages/ApplicationModuleMapPage';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/map/import-github" element={<GitHubImportPage />} />
        <Route path="/map/apps/:applicationId" element={<ApplicationModuleMapPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;

import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/layouts/Layout';
import { MapPage } from '@/features/map/pages/MapPage';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;

import { Navigate, useParams } from 'react-router-dom';
import { moduleGraphMapState } from '../utils/mapNavigation';

/**
 * Legacy route: /map/apps/:applicationId redirects to in-map module drill-down on /map.
 */
export function ApplicationModuleMapPage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const id = applicationId?.trim() ?? '';

  if (!id) {
    return <Navigate to="/map" replace />;
  }

  return <Navigate to="/map" replace state={moduleGraphMapState(id)} />;
}

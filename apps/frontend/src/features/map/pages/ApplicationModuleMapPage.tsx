import { Link, useParams } from 'react-router-dom';
import { ApplicationModuleGraph } from '../components/ApplicationModuleGraph';

/**
 * Drill-down: modules under one application (Cytoscape tree), route /map/apps/:applicationId.
 */
export function ApplicationModuleMapPage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const id = applicationId ?? '';

  return (
    <div className="map-page module-map-page">
      <div className="module-map-toolbar">
        <Link to="/" className="module-map-back">
          ← Retour à la carte des applications
        </Link>
        {id ? (
          <span className="module-map-title" title={id}>
            Modules — application <code>{id.length > 12 ? `${id.slice(0, 8)}…` : id}</code>
          </span>
        ) : null}
      </div>
      {id ? <ApplicationModuleGraph applicationId={id} /> : <p>Identifiant d’application manquant.</p>}
    </div>
  );
}

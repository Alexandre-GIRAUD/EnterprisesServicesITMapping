import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ApplicationResponse } from '@/types/api';
import { fetchApplications } from '@/features/map/api/applicationsApi';
import { PendingChangesPanel } from '@/features/map/components/PendingChangesPanel';
import type { MapLocationState } from '@/features/map/utils/mapNavigation';

/** Admin hub: pending change chips → detail pages. */
export function ChangesListPage() {
  const [applications, setApplications] = useState<ApplicationResponse[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const apps = await fetchApplications();
        if (!cancelled) setApplications(apps);
      } catch {
        /* names fall back to ids */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="changes-list-page">
      <div className="changes-list-header">
        <h1>Changes</h1>
        <p className="changes-list-lead">
          Review GitHub webhook suggestions before writing to Neo4j.
        </p>
        <Link
          to="/map"
          state={{ graphMode: 'normal', sideMenuTool: 'changes' } satisfies MapLocationState}
          className="changes-list-map-link"
        >
          Open in cartography →
        </Link>
      </div>
      <div className="changes-list-panel">
        <PendingChangesPanel variant="page" applications={applications} />
      </div>
    </div>
  );
}

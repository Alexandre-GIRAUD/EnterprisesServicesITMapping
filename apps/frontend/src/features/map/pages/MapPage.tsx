/**
 * Main map view: graph visualization and drill-down.
 * Includes application search to jump to module graph detail.
 */
import { ApplicationSearchBar } from '../components/ApplicationSearchBar';
import { GraphCanvas } from '../components/GraphCanvas';

export function MapPage() {
  return (
    <div className="map-page">
      <ApplicationSearchBar />
      <GraphCanvas />
    </div>
  );
}

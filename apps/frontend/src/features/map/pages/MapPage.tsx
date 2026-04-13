/**
 * Main map view: graph visualization and drill-down.
 * Will host Cytoscape.js and integrate with graph API.
 */
import { GraphCanvas } from '../components/GraphCanvas';

export function MapPage() {
  return (
    <div className="map-page">
      <GraphCanvas />
    </div>
  );
}

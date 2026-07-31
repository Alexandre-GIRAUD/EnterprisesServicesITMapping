/**
 * Main map view: graph visualization and drill-down.
 * Filters live in the FilterDrawer (applied on submit) inside GraphCanvas.
 */
import { GraphCanvas } from '../components/GraphCanvas';

export function MapPage() {
  return (
    <div className="map-page">
      <GraphCanvas />
    </div>
  );
}

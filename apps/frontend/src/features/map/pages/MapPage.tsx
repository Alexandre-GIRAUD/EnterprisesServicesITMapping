/**
 * Main map view: graph visualization and drill-down.
 * Includes application search to jump to module graph detail.
 * Year and other filters live in the FilterDrawer (applied on submit) inside GraphCanvas.
 */
import { ApplicationSearchBar } from '../components/ApplicationSearchBar';
import { GraphCanvas } from '../components/GraphCanvas';
import { MapGitHubImportButton } from '../components/MapGitHubImportButton';

export function MapPage() {
  return (
    <div className="map-page">
      <div className="map-filters-toolbar">
        <ApplicationSearchBar />
        <div className="map-toolbar-trailing">
          <MapGitHubImportButton />
        </div>
      </div>
      <GraphCanvas />
    </div>
  );
}

import { useState } from 'react';
/**
 * Main map view: graph visualization and drill-down.
 * Includes application search to jump to module graph detail.
 */
import { ApplicationSearchBar } from '../components/ApplicationSearchBar';
import { GraphCanvas } from '../components/GraphCanvas';
import { MapGitHubImportButton } from '../components/MapGitHubImportButton';

export function MapPage() {
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');

  return (
    <div className="map-page">
      <div className="map-filters-toolbar">
        <ApplicationSearchBar />
        <div className="map-date-filters" aria-label="Filtres de date (visuel uniquement)">
          <label className="map-date-filter-field">
            <span className="map-date-filter-label">Valid from</span>
            <input
              className="map-date-filter-input"
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
            />
          </label>
          <label className="map-date-filter-field">
            <span className="map-date-filter-label">Valid to</span>
            <input
              className="map-date-filter-input"
              type="date"
              value={validTo}
              onChange={(e) => setValidTo(e.target.value)}
            />
          </label>
        </div>
        <div className="map-toolbar-trailing">
          <MapGitHubImportButton />
        </div>
      </div>
      <GraphCanvas />
    </div>
  );
}

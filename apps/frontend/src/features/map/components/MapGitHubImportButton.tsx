import { Link } from 'react-router-dom';

export function MapGitHubImportButton() {
  return (
    <Link className="map-github-import-btn" to="/map/import-github">
      <span className="map-github-import-btn-label">Import GitHub</span>
      <span className="map-github-import-btn-meta" aria-hidden="true">
        Repos
      </span>
    </Link>
  );
}

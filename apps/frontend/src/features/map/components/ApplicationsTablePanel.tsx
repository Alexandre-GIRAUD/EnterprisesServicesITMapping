import { useMemo } from 'react';
import type { ApplicationResponse, GraphNodeDto } from '@/types/api';

type ApplicationsTablePanelProps = {
  isOpen: boolean;
  status: 'loading' | 'ready' | 'error';
  nodes: GraphNodeDto[];
  applicationsCatalog: ApplicationResponse[];
  errorMessage?: string | null;
  onRowClick: (id: string, label: string) => void;
};

function formatYear(value: number | null | undefined): string {
  return value != null ? String(value) : '—';
}

function dash(value: string | null | undefined): string {
  const t = value?.trim();
  return t ? t : '—';
}

export function ApplicationsTablePanel({
  isOpen,
  status,
  nodes,
  applicationsCatalog,
  errorMessage,
  onRowClick,
}: ApplicationsTablePanelProps) {
  const catalogById = useMemo(() => {
    const map = new Map<string, ApplicationResponse>();
    for (const app of applicationsCatalog) {
      map.set(app.id, app);
    }
    return map;
  }, [applicationsCatalog]);

  const rows = useMemo(() => {
    return nodes
      .filter((n) => n.type === 'Application')
      .map((n) => {
        const detail = catalogById.get(n.id);
        const regions =
          detail?.regions?.map((r) => r.code).filter(Boolean).join(', ') ?? '';
        return {
          id: n.id,
          name: n.label || n.id,
          description: n.description ?? detail?.description,
          year: n.year ?? detail?.year,
          businessUnit: detail?.businessUnit?.name ?? detail?.businessUnit?.code,
          regions,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [nodes, catalogById]);

  if (!isOpen) return null;

  return (
    <div
      id="graph-applications-table-panel"
      className="graph-table-panel graph-table-panel--light"
      role="region"
      aria-label="Table des applications du graphe"
    >
      {status === 'loading' && (
        <p className="graph-table-message" role="status">
          Chargement…
        </p>
      )}
      {status === 'error' && (
        <p className="graph-table-message graph-table-message-error" role="alert">
          {errorMessage ?? 'Impossible de charger le graphe.'}
        </p>
      )}
      {status === 'ready' && rows.length === 0 && (
        <p className="graph-table-message">Aucune application à afficher.</p>
      )}
      {status === 'ready' && rows.length > 0 && (
        <div className="graph-table-scroll">
          <table className="graph-table" aria-label="Applications du graphe">
            <thead>
              <tr>
                <th scope="col">Nom</th>
                <th scope="col">ID</th>
                <th scope="col">Description</th>
                <th scope="col">Business unit</th>
                <th scope="col">Régions</th>
                <th scope="col">Year</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="graph-table-row"
                  tabIndex={0}
                  onClick={() => onRowClick(row.id, row.name)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onRowClick(row.id, row.name);
                    }
                  }}
                >
                  <td>{row.name}</td>
                  <td>
                    <code className="graph-table-id">{row.id}</code>
                  </td>
                  <td>{dash(row.description)}</td>
                  <td>{dash(row.businessUnit)}</td>
                  <td>{dash(row.regions)}</td>
                  <td>{formatYear(row.year)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

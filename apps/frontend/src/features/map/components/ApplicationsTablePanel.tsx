import { useMemo } from 'react';
import type { ApplicationResponse, GraphNodeDto, GraphNodeFilterDto } from '@/types/api';
import { isSandboxId } from '../utils/sandboxGraph';

type ApplicationsTablePanelProps = {
  isOpen: boolean;
  variant?: 'embedded' | 'main';
  status: 'loading' | 'ready' | 'error';
  nodes: GraphNodeDto[];
  applicationsCatalog: ApplicationResponse[];
  /** Data Model target=NODE dimensions; one extra column per field. */
  nodeFilters: GraphNodeFilterDto[];
  errorMessage?: string | null;
  onRowClick: (id: string, label: string) => void;
};

function dash(value: string | null | undefined): string {
  const t = value?.trim();
  return t ? t : '—';
}

export function ApplicationsTablePanel({
  isOpen,
  variant = 'main',
  status,
  nodes,
  applicationsCatalog,
  nodeFilters,
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
        return {
          id: n.id,
          name: n.label || n.id,
          description: n.description ?? detail?.description,
          attributes: n.properties ?? detail?.nodeAttributes ?? {},
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [nodes, catalogById]);

  if (!isOpen) return null;

  const panelClass =
    variant === 'embedded'
      ? 'graph-table-panel graph-table-panel--light graph-table-panel--embedded'
      : 'graph-table-panel graph-table-panel--light graph-table-panel--main';

  return (
    <div
      id="graph-applications-table-panel"
      className={panelClass}
      role="region"
      aria-label="Graph applications table"
    >
      {status === 'loading' && (
        <p className="graph-table-message" role="status">
          Loading…
        </p>
      )}
      {status === 'error' && (
        <p className="graph-table-message graph-table-message-error" role="alert">
          {errorMessage ?? 'Unable to load the graph.'}
        </p>
      )}
      {status === 'ready' && rows.length === 0 && (
        <p className="graph-table-message">No applications to display.</p>
      )}
      {status === 'ready' && rows.length > 0 && (
        <div className="graph-table-scroll">
          <table className="graph-table" aria-label="Graph applications">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">ID</th>
                <th scope="col">Description</th>
                {nodeFilters.map((dimension) => (
                  <th scope="col" key={dimension.key}>
                    {dimension.label}
                  </th>
                ))}
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
                    <code
                      className={`graph-table-id${isSandboxId(row.id) ? ' graph-table-id--sandbox' : ''}`}
                    >
                      {row.id}
                    </code>
                  </td>
                  <td>{dash(row.description)}</td>
                  {nodeFilters.map((dimension) => (
                    <td key={dimension.key}>{dash(row.attributes[dimension.key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useMemo } from 'react';
import type { ApplicationResponse, GraphNodeDto, NodeRefSummary } from '@/types/api';
import { isSandboxId } from '../utils/sandboxGraph';
import type { TableColumnDef } from '../utils/tableColumns';

type ApplicationsTablePanelProps = {
  isOpen: boolean;
  variant?: 'embedded' | 'main';
  status: 'loading' | 'ready' | 'error';
  nodes: GraphNodeDto[];
  applicationsCatalog: ApplicationResponse[];
  columns: TableColumnDef[];
  errorMessage?: string | null;
  onRowClick: (id: string, label: string) => void;
};

function dash(value: string | null | undefined): string {
  const t = value?.trim();
  return t ? t : '—';
}

function formatNodeRefs(refs: NodeRefSummary[] | undefined): string {
  if (!refs || refs.length === 0) return '';
  return refs
    .map((r) => r.name?.trim() || r.value?.trim() || r.id)
    .filter(Boolean)
    .join(', ');
}

export function ApplicationsTablePanel({
  isOpen,
  variant = 'main',
  status,
  nodes,
  applicationsCatalog,
  columns,
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
          nodeRefs: detail?.nodeRefs ?? {},
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [nodes, catalogById]);

  function cellValue(
    row: (typeof rows)[number],
    column: TableColumnDef
  ): string {
    if (column.kind === 'structural') {
      if (column.key === 'name') return row.name;
      if (column.key === 'id') return row.id;
      if (column.key === 'description') return dash(row.description);
      return '—';
    }
    if (column.filterKind === 'NODE_REF') {
      return dash(formatNodeRefs(row.nodeRefs[column.key]));
    }
    return dash(row.attributes[column.key]);
  }

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
      aria-label="Apps table"
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
        <p className="graph-table-message">No apps to display.</p>
      )}
      {status === 'ready' && rows.length > 0 && columns.length === 0 && (
        <p className="graph-table-message">No columns to display. Open the menu to choose columns.</p>
      )}
      {status === 'ready' && rows.length > 0 && columns.length > 0 && (
        <div className="graph-table-scroll">
          <table className="graph-table" aria-label="Apps">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th scope="col" key={column.id}>
                    {column.label}
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
                  {columns.map((column) => {
                    const value = cellValue(row, column);
                    if (column.kind === 'structural' && column.key === 'id') {
                      return (
                        <td key={column.id}>
                          <code
                            className={`graph-table-id${isSandboxId(row.id) ? ' graph-table-id--sandbox' : ''}`}
                          >
                            {value}
                          </code>
                        </td>
                      );
                    }
                    return <td key={column.id}>{value}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

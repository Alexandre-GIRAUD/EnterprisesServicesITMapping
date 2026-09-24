import { useMemo } from 'react';
import type { GraphEdgeDto, GraphNodeDto, GraphNodeFilterDto } from '@/types/api';
import { isSandboxId } from '../utils/sandboxGraph';
import type { TableColumnDef } from '../utils/tableColumns';

type FeedsTablePanelProps = {
  isOpen: boolean;
  variant?: 'embedded' | 'main';
  status: 'loading' | 'ready' | 'error';
  edges: GraphEdgeDto[];
  nodes: GraphNodeDto[];
  columns: TableColumnDef[];
  /** EDGE dimensions (for allowedValues / option labels). */
  edgeFilters?: GraphNodeFilterDto[];
  errorMessage?: string | null;
  onRowClick?: (edge: GraphEdgeDto) => void;
};

function dash(value: string | null | undefined): string {
  const t = value?.trim();
  return t ? t : '—';
}

function edgeProp(edge: GraphEdgeDto, key: string): string | undefined {
  const fromProps = edge.properties?.[key]?.trim();
  if (fromProps) return fromProps;
  if (key === 'data' && edge.data?.trim()) return edge.data.trim();
  return undefined;
}

function labelForEdgeValue(
  key: string,
  raw: string | undefined,
  edgeFilters: GraphNodeFilterDto[]
): string {
  if (!raw) return '';
  const dimension = edgeFilters.find((f) => f.key === key);
  const fromOptions = dimension?.options?.find((o) => o.id === raw || o.name === raw)?.name;
  if (fromOptions?.trim()) return fromOptions.trim();
  return raw;
}

export function FeedsTablePanel({
  isOpen,
  variant = 'main',
  status,
  edges,
  nodes,
  columns,
  edgeFilters = [],
  errorMessage,
  onRowClick,
}: FeedsTablePanelProps) {
  const labelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of nodes) {
      map.set(node.id, node.label || node.id);
    }
    return map;
  }, [nodes]);

  const rows = useMemo(() => {
    return edges
      .map((edge) => ({
        id: edge.id,
        edge,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        sourceLabel: labelById.get(edge.sourceId) ?? edge.sourceId,
        targetLabel: labelById.get(edge.targetId) ?? edge.targetId,
        type: edge.type,
      }))
      .sort((a, b) => {
        const bySource = a.sourceLabel.localeCompare(b.sourceLabel, undefined, {
          sensitivity: 'base',
        });
        if (bySource !== 0) return bySource;
        return a.targetLabel.localeCompare(b.targetLabel, undefined, { sensitivity: 'base' });
      });
  }, [edges, labelById]);

  function cellValue(row: (typeof rows)[number], column: TableColumnDef): string {
    if (column.kind === 'structural') {
      if (column.key === 'source') return row.sourceLabel;
      if (column.key === 'target') return row.targetLabel;
      if (column.key === 'id') return row.id;
      if (column.key === 'type') return dash(row.type);
      return '—';
    }
    const raw = edgeProp(row.edge, column.key);
    return dash(labelForEdgeValue(column.key, raw, edgeFilters));
  }

  if (!isOpen) return null;

  const panelClass =
    variant === 'embedded'
      ? 'graph-table-panel graph-table-panel--light graph-table-panel--embedded'
      : 'graph-table-panel graph-table-panel--light graph-table-panel--main';

  return (
    <div
      id="graph-feeds-table-panel"
      className={panelClass}
      role="region"
      aria-label="Flows table"
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
        <p className="graph-table-message">No flows to display.</p>
      )}
      {status === 'ready' && rows.length > 0 && columns.length === 0 && (
        <p className="graph-table-message">No columns to display. Open the menu to choose columns.</p>
      )}
      {status === 'ready' && rows.length > 0 && columns.length > 0 && (
        <div className="graph-table-scroll">
          <table className="graph-table" aria-label="Flows">
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
                  className={`graph-table-row${onRowClick ? '' : ' graph-table-row--static'}`}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row.edge) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onRowClick(row.edge);
                          }
                        }
                      : undefined
                  }
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

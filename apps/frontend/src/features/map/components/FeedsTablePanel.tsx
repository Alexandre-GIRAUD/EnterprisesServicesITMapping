import { useMemo } from 'react';
import type { GraphEdgeDto, GraphNodeDto } from '@/types/api';
import { legendLabelForData } from './graphTheme';
import { isSandboxId } from '../utils/sandboxGraph';

type FeedsTablePanelProps = {
  isOpen: boolean;
  variant?: 'embedded' | 'main';
  status: 'loading' | 'ready' | 'error';
  edges: GraphEdgeDto[];
  nodes: GraphNodeDto[];
  errorMessage?: string | null;
  onRowClick?: (sourceId: string, sourceLabel: string) => void;
};

function dash(value: string | null | undefined): string {
  const t = value?.trim();
  return t ? t : '—';
}

function prop(edge: GraphEdgeDto, key: string): string | undefined {
  const fromProps = edge.properties?.[key]?.trim();
  if (fromProps) return fromProps;
  if (key === 'data' && edge.data?.trim()) return edge.data.trim();
  return undefined;
}

export function FeedsTablePanel({
  isOpen,
  variant = 'main',
  status,
  edges,
  nodes,
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
      .map((edge) => {
        const data = prop(edge, 'data');
        const connectionKind = prop(edge, 'connection_kind');
        return {
          id: edge.id,
          sourceId: edge.sourceId,
          targetId: edge.targetId,
          sourceLabel: labelById.get(edge.sourceId) ?? edge.sourceId,
          targetLabel: labelById.get(edge.targetId) ?? edge.targetId,
          type: edge.type,
          data,
          dataLabel: data ? legendLabelForData(data) : undefined,
          connectionKind,
          connectionKindLabel: connectionKind ? legendLabelForData(connectionKind) : undefined,
        };
      })
      .sort((a, b) => {
        const bySource = a.sourceLabel.localeCompare(b.sourceLabel, undefined, { sensitivity: 'base' });
        if (bySource !== 0) return bySource;
        return a.targetLabel.localeCompare(b.targetLabel, undefined, { sensitivity: 'base' });
      });
  }, [edges, labelById]);

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
      {status === 'ready' && rows.length > 0 && (
        <div className="graph-table-scroll">
          <table className="graph-table" aria-label="Flows">
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">Target</th>
                <th scope="col">ID</th>
                <th scope="col">Exchanged data</th>
                <th scope="col">Integration kind</th>
                <th scope="col">Type</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={`graph-table-row${onRowClick ? '' : ' graph-table-row--static'}`}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row.sourceId, row.sourceLabel) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onRowClick(row.sourceId, row.sourceLabel);
                          }
                        }
                      : undefined
                  }
                >
                  <td>{row.sourceLabel}</td>
                  <td>{row.targetLabel}</td>
                  <td>
                    <code
                      className={`graph-table-id${isSandboxId(row.id) ? ' graph-table-id--sandbox' : ''}`}
                    >
                      {row.id}
                    </code>
                  </td>
                  <td>{dash(row.dataLabel ?? row.data)}</td>
                  <td>{dash(row.connectionKindLabel ?? row.connectionKind)}</td>
                  <td>{dash(row.type)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

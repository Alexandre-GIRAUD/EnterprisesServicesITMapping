import { useEffect, useMemo, useState } from 'react';
import type { DataModelFieldDto } from '@/types/api';
import { getDataModelRequest } from '@/features/datamodel/api/dataModelApi';
import type { SelectedEdgeDetails } from '../utils/selectedEdgeFromDto';
import { legendLabelForData } from './graphTheme';
import { CommentsSection } from '@/features/comments/components/CommentsSection';

type EdgeDetailsDrawerProps = {
  isOpen: boolean;
  edge: SelectedEdgeDetails | null;
  onClose: () => void;
  onOpenApplication?: (applicationId: string, label: string) => void;
};

function dash(value: string | null | undefined): string {
  const t = value?.trim();
  return t ? t : 'Not provided';
}

function titleForEdge(edge: SelectedEdgeDetails): string {
  const data = edge.data?.trim();
  if (data) return legendLabelForData(data);
  return edge.type || 'Connection';
}

/**
 * Right-hand details panel for a graph edge (DEPENDS_ON / etc.).
 * Mirrors ApplicationDetailsDrawer layout; read-only in v1.
 */
export function EdgeDetailsDrawer({
  isOpen,
  edge,
  onClose,
  onOpenApplication,
}: EdgeDetailsDrawerProps) {
  const [edgeFields, setEdgeFields] = useState<DataModelFieldDto[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void getDataModelRequest()
      .then((data) => {
        if (cancelled) return;
        setEdgeFields(data.fields.filter((f) => f.target === 'EDGE'));
      })
      .catch(() => {
        if (!cancelled) setEdgeFields([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const attributeRows = useMemo(() => {
    const stored = edge?.properties ?? {};
    const rows = edgeFields.map((field) => ({
      key: field.key,
      label: field.label || field.key,
      value: stored[field.key] ?? '',
    }));
    const known = new Set(edgeFields.map((f) => f.key));
    for (const [key, value] of Object.entries(stored)) {
      if (!known.has(key) && key !== 'data') {
        rows.push({ key, label: key, value });
      }
    }
    return rows;
  }, [edge?.properties, edgeFields]);

  const title = edge ? titleForEdge(edge) : 'Connection';

  return (
    <aside
      className={`graph-details-drawer graph-details-drawer--edge${isOpen ? ' is-open' : ''}`}
      aria-hidden={!isOpen}
      aria-label="Connection details panel"
    >
      <header className="graph-details-header">
        <p className="graph-drawer-eyebrow">
          {edge?.sandbox ? 'Connection (sandbox)' : 'Connection'}
        </p>
        <div className="graph-drawer-title-row">
          <div className="graph-details-header-main">
            <h2 className="graph-drawer-title" title={title}>
              {title}
            </h2>
            {edge?.id ? (
              <p className="graph-details-id" title={edge.id}>
                {edge.id}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="graph-drawer-close"
            onClick={onClose}
            aria-label="Close connection details"
          >
            x
          </button>
        </div>
      </header>

      <div className="graph-details-content">
        {!edge ? (
          <p className="graph-details-text">No connection selected.</p>
        ) : (
          <>
            <section className="graph-details-section">
              <h3 className="graph-details-section-title">Endpoints</h3>
              <dl className="graph-details-attribute-list">
                <div className="graph-details-attribute-row">
                  <dt className="graph-details-attribute-label">Source</dt>
                  <dd className="graph-details-text">
                    <span title={edge.sourceId}>{edge.sourceLabel}</span>
                    {onOpenApplication ? (
                      <>
                        {' '}
                        <button
                          type="button"
                          className="graph-details-inline-link"
                          onClick={() => onOpenApplication(edge.sourceId, edge.sourceLabel)}
                        >
                          View
                        </button>
                      </>
                    ) : null}
                  </dd>
                </div>
                <div className="graph-details-attribute-row">
                  <dt className="graph-details-attribute-label">Target</dt>
                  <dd className="graph-details-text">
                    <span title={edge.targetId}>{edge.targetLabel}</span>
                    {onOpenApplication ? (
                      <>
                        {' '}
                        <button
                          type="button"
                          className="graph-details-inline-link"
                          onClick={() => onOpenApplication(edge.targetId, edge.targetLabel)}
                        >
                          View
                        </button>
                      </>
                    ) : null}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="graph-details-section">
              <h3 className="graph-details-section-title">Relation</h3>
              <dl className="graph-details-attribute-list">
                <div className="graph-details-attribute-row">
                  <dt className="graph-details-attribute-label">Type</dt>
                  <dd className="graph-details-text">{dash(edge.type)}</dd>
                </div>
                <div className="graph-details-attribute-row">
                  <dt className="graph-details-attribute-label">Data / flow</dt>
                  <dd className="graph-details-text">{dash(edge.data)}</dd>
                </div>
              </dl>
            </section>

            <section className="graph-details-section">
              <h3 className="graph-details-section-title">Edge attributes</h3>
              {attributeRows.length === 0 ? (
                <p className="graph-details-text">
                  No edge attribute configured. Add Data Model fields targeting Connection
                  (edge) to describe this link.
                </p>
              ) : (
                <dl className="graph-details-attribute-list">
                  {attributeRows.map((row) => (
                    <div className="graph-details-attribute-row" key={row.key}>
                      <dt className="graph-details-attribute-label">{row.label}</dt>
                      <dd className="graph-details-text">
                        {row.value.trim() ? row.value : 'Not provided'}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>

            <CommentsSection
              targetType="EDGE"
              targetId={edge.id}
              enabled={!edge.sandbox}
            />
          </>
        )}
      </div>
    </aside>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/AuthContext';
import {
  getDataModelPromptPreviewRequest,
  getDataModelRequest,
  putDataModelRequest,
} from '@/features/datamodel/api/dataModelApi';
import {
  DataModelAttributeRow,
  type AttributeRowChange,
} from '@/features/datamodel/components/DataModelAttributeRow';
import { DataModelIcon } from '@/features/datamodel/components/DataModelIcons';
import { DataModelToolbar } from '@/features/datamodel/components/DataModelToolbar';
import {
  applySavedFields,
  buildSavePayload,
  countRows,
  createEmptyRow,
  discardRowChanges,
  filterRows,
  isRowDirty,
  moveRow,
  rowsFromFields,
  validateRow,
  type AttributeFilters,
  type AttributeRow,
} from '../dataModelAttributes';
import type { DataModelSurface } from '../dataModelSurface';

const NO_FILTERS: AttributeFilters = {
  query: '',
  detection: 'ALL',
  isRequiredOnly: false,
  isControlledOnly: false,
};
const LIST_BUSY = 'list';
const SURFACE_TABS: Array<{ surface: DataModelSurface; label: string }> = [
  { surface: 'app', label: 'Application' },
  { surface: 'flows', label: 'Flows' },
];

type StatusMessage = { isError: boolean; text: string };

function formatUpdatedAt(updatedAt: string): string {
  const date = new Date(updatedAt);
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `Updated on ${date.toLocaleDateString()} at ${time}`;
}

function useUnsavedChangesWarning(hasUnsavedChanges: boolean) {
  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsavedChanges]);
}

export function DataModelPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<AttributeRow[]>([]);
  const [surface, setSurface] = useState<DataModelSurface>('app');
  const [filters, setFilters] = useState<AttributeFilters>(NO_FILTERS);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [promptPreview, setPromptPreview] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const hasUnsavedChanges = rows.some(isRowDirty);
  useUnsavedChangesWarning(hasUnsavedChanges);

  const reload = useCallback(async () => {
    const data = await getDataModelRequest();
    setRows(rowsFromFields(data.fields));
    setUpdatedAt(data.updatedAt);
    setPromptPreview(await getDataModelPromptPreviewRequest());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await reload();
        if (!cancelled) setLoadError(null);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Unable to load.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  async function persist(nextRows: AttributeRow[], options: { editedRowId?: string; successText: string }) {
    const previousRows = rows;
    const payload = buildSavePayload(nextRows, options.editedRowId);
    setRows(nextRows);
    setBusy(options.editedRowId ?? LIST_BUSY);
    setStatus(null);
    try {
      const saved = await putDataModelRequest({ fields: payload.fields });
      setRows((current) => applySavedFields(current, payload.rowIds, saved.fields, options.editedRowId));
      setUpdatedAt(saved.updatedAt);
      setStatus({ isError: false, text: options.successText });
    } catch (error) {
      if (!options.editedRowId) setRows(previousRows);
      setStatus({ isError: true, text: error instanceof Error ? error.message : 'Unable to save.' });
      return;
    } finally {
      setBusy(null);
    }
    getDataModelPromptPreviewRequest()
      .then(setPromptPreview)
      .catch(() => setStatus({ isError: true, text: 'Saved, but the prompt preview could not be refreshed.' }));
  }

  function changeRow(rowId: string, change: AttributeRowChange) {
    setRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? {
              ...row,
              draft: { ...row.draft, ...change.draft },
              allowedValuesText: change.allowedValuesText ?? row.allowedValuesText,
            }
          : row
      )
    );
  }

  function toggleRow(rowId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (!next.delete(rowId)) next.add(rowId);
      return next;
    });
  }

  function addRow() {
    const row = createEmptyRow(surface);
    setFilters(NO_FILTERS);
    setRows((current) => [...current, row]);
    setExpandedIds((current) => new Set(current).add(row.id));
  }

  function discardRow(rowId: string) {
    setRows((current) => current.map((row) => (row.id === rowId ? discardRowChanges(row) : row)));
  }

  function deleteRow(row: AttributeRow) {
    if (!window.confirm(`Delete attribute "${row.draft.key || 'New attribute'}"?`)) return;
    const nextRows = rows.filter((other) => other.id !== row.id);
    if (!row.saved) {
      setRows(nextRows);
      return;
    }
    void persist(nextRows, { successText: 'Attribute deleted.' });
  }

  function dropRow(targetId: string) {
    setDropTargetId(null);
    setDraggedId(null);
    if (!draggedId || draggedId === targetId) return;
    void persist(moveRow(rows, draggedId, targetId), { successText: 'Order saved.' });
  }

  async function refresh() {
    if (hasUnsavedChanges && !window.confirm('Discard unsaved changes and reload the Data Model?')) return;
    setStatus(null);
    try {
      await reload();
    } catch (error) {
      setStatus({ isError: true, text: error instanceof Error ? error.message : 'Unable to load.' });
    }
  }

  if (loadError) {
    return (
      <div className="data-model-page">
        <p className="data-model-error">{loadError}</p>
        <Link to="/map" className="auth-link">
          Back to map
        </Link>
      </div>
    );
  }

  const surfaceRows = filterRows(rows, surface, NO_FILTERS);
  const visibleRows = filterRows(rows, surface, filters);

  return (
    <div className="data-model-page">
      <header className="data-model-header">
        <div>
          <h1>Data Model</h1>
          <p className="data-model-lead">
            Define the attributes available on the nodes and connections of your graph.
          </p>
        </div>
        {isAdmin ? (
          <button type="button" className="data-model-primary-btn data-model-add-btn" onClick={addRow}>
            <DataModelIcon name="plus" />
            Add attribute
          </button>
        ) : null}
      </header>

      <div className="data-model-subheader">
        <div className="graph-display-toggle" role="tablist" aria-label="Data model surface">
          {SURFACE_TABS.map((tab) => (
            <button
              key={tab.surface}
              type="button"
              role="tab"
              className={`graph-display-toggle-btn${surface === tab.surface ? ' is-active' : ''}`}
              aria-selected={surface === tab.surface}
              onClick={() => setSurface(tab.surface)}
            >
              <span className="graph-display-toggle-label">{tab.label}</span>
            </button>
          ))}
        </div>
        <button type="button" className="data-model-icon-btn" onClick={refresh} aria-label="Reload the Data Model">
          <DataModelIcon name="refresh" />
        </button>
        {updatedAt ? <span className="data-model-meta">{formatUpdatedAt(updatedAt)}</span> : null}
      </div>

      {!isAdmin ? (
        <p className="data-model-readonly">Read-only view. Only administrators can edit the Data Model.</p>
      ) : null}

      <DataModelToolbar counts={countRows(surfaceRows)} filters={filters} onFiltersChange={setFilters} />

      {status ? (
        <p className={status.isError ? 'data-model-error' : 'data-model-success'} role="status">
          {status.text}
        </p>
      ) : null}

      <div className="data-model-fields">
        {surfaceRows.length === 0 ? (
          <div className="data-model-banner" role="status">
            No attributes yet. Scan connections and attributes discovers technical topology only (peer, direction,
            connection_kind, channel).
          </div>
        ) : null}
        {surfaceRows.length > 0 && visibleRows.length === 0 ? (
          <p className="data-model-empty">No attribute matches your search or filters.</p>
        ) : null}
        {visibleRows.map((row) => (
          <DataModelAttributeRow
            key={row.id}
            row={row}
            rowError={validateRow(row, rows)}
            surface={surface}
            isExpanded={expandedIds.has(row.id)}
            isAdmin={isAdmin}
            isBusy={busy !== null}
            isDropTarget={dropTargetId === row.id && draggedId !== row.id}
            onToggle={() => toggleRow(row.id)}
            onChange={(change) => changeRow(row.id, change)}
            onSave={() => void persist(rows, { editedRowId: row.id, successText: 'Attribute saved.' })}
            onDiscard={() => discardRow(row.id)}
            onDelete={() => deleteRow(row)}
            onDragStart={() => setDraggedId(row.id)}
            onDragEnter={() => setDropTargetId(row.id)}
            onDrop={() => dropRow(row.id)}
          />
        ))}
        {isAdmin ? (
          <button type="button" className="data-model-add-row" onClick={addRow}>
            <DataModelIcon name="plus" />
            Add attribute
          </button>
        ) : null}
      </div>

      <details className="data-model-panel">
        <summary>Prompt preview</summary>
        <p className="data-model-lead">
          Section(s) injected into the connection-discovery prompt for AI-detected attributes (manual
          attributes are excluded). Edge, Application (node) and Application (reference) attributes appear in
          separate sections.
        </p>
        <pre className="data-model-preview">{promptPreview.trim() || '(empty — topology-only mode)'}</pre>
      </details>
    </div>
  );
}

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { DataModelFieldDto, DataSourceDto, DataSourceRequest } from '@/types/api';
import { getDataModelRequest } from '@/features/datamodel/api/dataModelApi';
import {
  createSource,
  deleteSource,
  listSources,
  previewSource,
  syncSource,
  updateSource,
} from '../api/sourcesApi';
import { SourceMappingAlert } from './SourceMappingAlert';
import { SourceMappingEditor } from './SourceMappingEditor';

type SourceDraft = DataSourceRequest & { secret: string };

const EMPTY: SourceDraft = {
  name: '',
  kind: 'API',
  endpoint: '',
  toolName: null,
  itemsPath: null,
  authType: 'NONE',
  authHeaderName: null,
  authUsername: null,
  keyColumn: null,
  columnMap: {},
  secret: '',
};

type DataSourcesPanelProps = { isAdmin: boolean };

export function DataSourcesPanel({ isAdmin }: DataSourcesPanelProps) {
  const [sources, setSources] = useState<DataSourceDto[]>([]);
  const [nodeFields, setNodeFields] = useState<DataModelFieldDto[]>([]);
  const [draft, setDraft] = useState<SourceDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [mappingId, setMappingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  const reload = useCallback(async () => {
    setSources(await listSources());
    const model = await getDataModelRequest();
    setNodeFields(model.fields.filter((field) => field.target === 'NODE'));
    setRefresh((n) => n + 1);
  }, []);

  useEffect(() => {
    reload().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unable to load sources.'));
  }, [reload]);

  async function run(action: () => Promise<void>) {
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Request failed.');
    }
  }

  function startEdit(source: DataSourceDto | null) {
    setColumns([]);
    setEditingId(source?.id ?? null);
    setDraft(source ? { ...source, secret: '' } : { ...EMPTY });
  }

  function patch(change: Partial<SourceDraft>) {
    setDraft((current) => (current ? { ...current, ...change } : current));
  }

  function patchColumn(fieldKey: string, column: string) {
    setDraft((current) =>
      current ? { ...current, columnMap: { ...current.columnMap, [fieldKey]: column } } : current,
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    await run(async () => {
      const saved = editingId ? await updateSource(editingId, draft) : await createSource(draft);
      setEditingId(saved.id);
      setDraft({ ...saved, secret: '' });
      setMessage('Source saved.');
      await reload();
    });
  }

  async function onTest() {
    if (!editingId) return;
    await run(async () => {
      const result = await previewSource(editingId);
      setColumns(result.columns);
      setMessage(`Connected: ${result.rowCount} rows, ${result.columns.length} columns.`);
    });
  }

  async function onSync(id: string) {
    await run(async () => {
      const result = await syncSource(id);
      const rejected = result.failedApplications ? `, ${result.failedApplications} rejected values` : '';
      const missing = result.fieldsWithoutColumn.length
        ? `. Column not defined: ${result.fieldsWithoutColumn.join(', ')}`
        : '.';
      setMessage(`Synced ${result.updatedApplications} applications${rejected}${missing}`);
    });
  }

  async function onDelete(id: string) {
    await run(async () => {
      await deleteSource(id);
      if (editingId === id) setDraft(null);
      await reload();
    });
  }

  const mappingSource = sources.find((source) => source.id === mappingId) ?? null;
  const editingSource = sources.find((source) => source.id === editingId) ?? null;

  return (
    <div className="data-sources">
      <SourceMappingAlert refreshKey={refresh} onOpenMapping={setMappingId} />
      {error ? (
        <p className="github-import-state github-import-state-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="github-import-state" role="status">
          {message}
        </p>
      ) : null}

      <ul className="source-list" aria-label="Data sources">
        {sources.map((source) => (
          <li key={source.id} className="source-item">
            <strong>{source.name}</strong> <span className="source-hint">{source.kind}</span>
            {isAdmin ? (
              <span className="source-actions">
                <button type="button" className="github-import-btn-secondary" onClick={() => startEdit(source)}>
                  Edit
                </button>
                <button type="button" className="github-import-btn-secondary" onClick={() => setMappingId(source.id)}>
                  Mapping
                </button>
                <button type="button" className="github-import-btn-secondary" onClick={() => void onSync(source.id)}>
                  Sync
                </button>
                <button type="button" className="github-import-btn-secondary" onClick={() => void onDelete(source.id)}>
                  Delete
                </button>
              </span>
            ) : null}
          </li>
        ))}
        {sources.length === 0 ? <li className="source-hint">No data source yet.</li> : null}
      </ul>

      {isAdmin && !draft ? (
        <button type="button" className="github-import-btn" onClick={() => startEdit(null)}>
          Add a source
        </button>
      ) : null}

      {mappingSource ? (
        <SourceMappingEditor
          sourceId={mappingSource.id}
          sourceName={mappingSource.name}
          onClose={() => setMappingId(null)}
          onSaved={() => void reload()}
        />
      ) : null}

      {draft ? (
        <form className="github-import-third-party-form" onSubmit={(event) => void onSubmit(event)}>
          <label className="github-import-search-label">
            <span className="github-import-search-span">Name</span>
            <input
              className="github-import-search-input"
              required
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </label>
          <label className="github-import-search-label">
            <span className="github-import-search-span">Type</span>
            <select
              className="github-import-search-input"
              value={draft.kind}
              onChange={(e) => patch({ kind: e.target.value as SourceDraft['kind'] })}
            >
              <option value="API">API (GET, JSON list)</option>
              <option value="MCP">MCP server</option>
            </select>
          </label>
          <label className="github-import-search-label">
            <span className="github-import-search-span">{draft.kind === 'MCP' ? 'Server URL' : 'Endpoint'}</span>
            <input
              className="github-import-search-input"
              required
              type="url"
              value={draft.endpoint}
              onChange={(e) => patch({ endpoint: e.target.value })}
            />
          </label>
          {draft.kind === 'MCP' ? (
            <label className="github-import-search-label">
              <span className="github-import-search-span">Tool name</span>
              <input
                className="github-import-search-input"
                required
                value={draft.toolName ?? ''}
                onChange={(e) => patch({ toolName: e.target.value })}
              />
            </label>
          ) : null}
          <label className="github-import-search-label">
            <span className="github-import-search-span">Path to the list (optional, e.g. data.items)</span>
            <input
              className="github-import-search-input"
              value={draft.itemsPath ?? ''}
              onChange={(e) => patch({ itemsPath: e.target.value })}
            />
          </label>
          <label className="github-import-search-label">
            <span className="github-import-search-span">Authentication</span>
            <select
              className="github-import-search-input"
              value={draft.authType}
              onChange={(e) => patch({ authType: e.target.value as SourceDraft['authType'] })}
            >
              <option value="NONE">None</option>
              <option value="BEARER">Bearer token</option>
              <option value="API_KEY">API key header</option>
              <option value="BASIC">Basic</option>
            </select>
          </label>
          {draft.authType === 'API_KEY' ? (
            <label className="github-import-search-label">
              <span className="github-import-search-span">Header name</span>
              <input
                className="github-import-search-input"
                value={draft.authHeaderName ?? ''}
                onChange={(e) => patch({ authHeaderName: e.target.value })}
              />
            </label>
          ) : null}
          {draft.authType === 'BASIC' ? (
            <label className="github-import-search-label">
              <span className="github-import-search-span">Username</span>
              <input
                className="github-import-search-input"
                value={draft.authUsername ?? ''}
                onChange={(e) => patch({ authUsername: e.target.value })}
              />
            </label>
          ) : null}
          {draft.authType !== 'NONE' ? (
            <label className="github-import-search-label">
              <span className="github-import-search-span">
                Secret{editingSource?.secretSet ? ' (set, leave blank to keep)' : ''}
              </span>
              <input
                className="github-import-search-input"
                type="password"
                autoComplete="new-password"
                value={draft.secret}
                onChange={(e) => patch({ secret: e.target.value })}
              />
            </label>
          ) : null}
          <label className="github-import-search-label">
            <span className="github-import-search-span">Key column (the application identifier in the source)</span>
            <input
              className="github-import-search-input"
              list="source-columns"
              value={draft.keyColumn ?? ''}
              onChange={(e) => patch({ keyColumn: e.target.value })}
            />
          </label>
          <datalist id="source-columns">
            {columns.map((column) => (
              <option key={column} value={column} />
            ))}
          </datalist>
          {nodeFields.length > 0 ? <p className="source-hint">Column feeding each application attribute</p> : null}
          {nodeFields.map((field) => (
            <label key={field.key} className="github-import-search-label">
              <span className="github-import-search-span">{field.label}</span>
              <input
                className="github-import-search-input"
                list="source-columns"
                value={draft.columnMap[field.key] ?? ''}
                onChange={(e) => patchColumn(field.key, e.target.value)}
              />
            </label>
          ))}
          <div className="source-actions">
            <button type="submit" className="github-import-btn">
              Save
            </button>
            <button
              type="button"
              className="github-import-btn-secondary"
              disabled={!editingId}
              onClick={() => void onTest()}
            >
              Test connection
            </button>
            <button type="button" className="github-import-btn-secondary" onClick={() => setDraft(null)}>
              Close
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import type { DataModelFieldDto, DataSourceDto, SourceNameDto, SourceSyncResponse } from '@/types/api';
import { getDataModelRequest } from '@/features/datamodel/api/dataModelApi';
import { attributesFedBySource } from '@/features/datamodel/dataModelSource';
import {
  createSource,
  deleteSource,
  listSourceNames,
  listSources,
  previewSource,
  syncSource,
  updateSource,
} from '../api/sourcesApi';
import { SourceForm, type SourceDraft } from './SourceForm';
import { SourceMappingAlert } from './SourceMappingAlert';
import { SourceMappingEditor } from './SourceMappingEditor';

const EMPTY_DRAFT: SourceDraft = {
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

const FALLBACK_ERROR = 'Request failed.';

function describeSync(result: SourceSyncResponse): string {
  const parts = [`Synced ${result.updatedApplications} applications`];
  if (result.failedApplications) parts.push(`${result.failedApplications} rejected values`);
  if (result.missingKeyApplications) parts.push(`${result.missingKeyApplications} keys not found in the source`);
  if (result.fieldsWithoutColumn.length) parts.push(`column not defined: ${result.fieldsWithoutColumn.join(', ')}`);
  return `${parts.join(', ')}.`;
}

type DataSourcesPanelProps = { isAdmin: boolean; initialMappingId?: string | null };

export function DataSourcesPanel({ isAdmin, initialMappingId = null }: DataSourcesPanelProps) {
  const [sources, setSources] = useState<SourceNameDto[]>([]);
  const [definitions, setDefinitions] = useState<DataSourceDto[]>([]);
  const [nodeFields, setNodeFields] = useState<DataModelFieldDto[]>([]);
  const [draft, setDraft] = useState<SourceDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [mappingId, setMappingId] = useState<string | null>(initialMappingId);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alertVersion, setAlertVersion] = useState(0);

  const reload = useCallback(async () => {
    setSources(await listSourceNames());
    if (isAdmin) {
      setDefinitions(await listSources());
      const model = await getDataModelRequest();
      setNodeFields(model.fields.filter((field) => field.target === 'NODE'));
    }
    setAlertVersion((version) => version + 1);
  }, [isAdmin]);

  useEffect(() => {
    reload().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to load sources.'));
  }, [reload]);

  async function run(action: () => Promise<void>) {
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : FALLBACK_ERROR);
    }
  }

  function startEdit(id: string | null) {
    const definition = definitions.find((item) => item.id === id);
    setColumns([]);
    setEditingId(definition?.id ?? null);
    setDraft(definition ? { ...definition, secret: '' } : { ...EMPTY_DRAFT });
  }

  function changeDraft(change: Partial<SourceDraft>) {
    setDraft((current) => (current ? { ...current, ...change } : current));
  }

  function changeColumn(fieldKey: string, column: string) {
    setDraft((current) =>
      current ? { ...current, columnMap: { ...current.columnMap, [fieldKey]: column } } : current,
    );
  }

  async function saveDraft() {
    if (!draft) return;
    await run(async () => {
      const saved = editingId ? await updateSource(editingId, draft) : await createSource(draft);
      setEditingId(saved.id);
      setDraft({ ...saved, secret: '' });
      setMessage('Source saved.');
      await reload();
    });
  }

  async function testConnection() {
    if (!editingId) return;
    await run(async () => {
      const result = await previewSource(editingId);
      setColumns(result.columns);
      setMessage(`Connected: ${result.rowCount} rows, ${result.columns.length} columns.`);
    });
  }

  async function syncNow(id: string) {
    await run(async () => setMessage(describeSync(await syncSource(id))));
  }

  async function removeSource(id: string) {
    await run(async () => {
      await deleteSource(id);
      if (editingId === id) setDraft(null);
      await reload();
    });
  }

  const mappingSource = sources.find((source) => source.id === mappingId) ?? null;
  const editingSource = definitions.find((source) => source.id === editingId) ?? null;

  return (
    <div className="data-sources">
      <SourceMappingAlert refreshKey={alertVersion} onOpenMapping={setMappingId} />
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
                <button type="button" className="github-import-text-button" onClick={() => startEdit(source.id)}>
                  Edit
                </button>
                <button type="button" className="github-import-text-button" onClick={() => setMappingId(source.id)}>
                  Mapping
                </button>
                <button type="button" className="github-import-text-button" onClick={() => void syncNow(source.id)}>
                  Sync
                </button>
                <button type="button" className="github-import-text-button" onClick={() => void removeSource(source.id)}>
                  Delete
                </button>
              </span>
            ) : null}
          </li>
        ))}
        {sources.length === 0 ? <li className="source-hint">No data source yet.</li> : null}
      </ul>

      {isAdmin && !draft ? (
        <button type="button" className="github-import-primary" onClick={() => startEdit(null)}>
          Add a source
        </button>
      ) : null}

      {isAdmin && mappingSource ? (
        <SourceMappingEditor
          sourceId={mappingSource.id}
          sourceName={mappingSource.name}
          onClose={() => setMappingId(null)}
          onSaved={() => void reload()}
        />
      ) : null}

      {draft ? (
        <SourceForm
          draft={draft}
          editingSource={editingSource}
          nodeFields={attributesFedBySource(nodeFields, editingId)}
          columns={columns}
          onChange={changeDraft}
          onColumnChange={changeColumn}
          onSubmit={() => void saveDraft()}
          onTest={() => void testConnection()}
          onClose={() => setDraft(null)}
        />
      ) : null}
    </div>
  );
}

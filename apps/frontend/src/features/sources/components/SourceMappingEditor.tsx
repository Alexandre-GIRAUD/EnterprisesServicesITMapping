import { useEffect, useState } from 'react';
import { getSourceMapping, saveSourceMapping } from '../api/sourcesApi';
import { mappingRows, toMappingPayload, type MappingRow } from '../mappingDraft';

type SourceMappingEditorProps = {
  sourceId: string;
  sourceName: string;
  onClose: () => void;
  onSaved: () => void;
};

export function SourceMappingEditor({ sourceId, sourceName, onClose, onSaved }: SourceMappingEditorProps) {
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [keys, setKeys] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSourceMapping(sourceId)
      .then((mapping) => {
        if (cancelled) return;
        setKeys(mapping.sourceKeys);
        setRows(mappingRows(mapping.applications, mapping.entries, mapping.suggestions));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unable to load the mapping.');
      });
    return () => {
      cancelled = true;
    };
  }, [sourceId]);

  function change(applicationId: string, patch: Partial<MappingRow>) {
    setRows((current) =>
      current.map((row) => (row.applicationId === applicationId ? { ...row, ...patch, suggested: false } : row)),
    );
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await saveSourceMapping(sourceId, toMappingPayload(rows));
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unable to save the mapping.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="source-mapping" aria-label={`Mapping for ${sourceName}`}>
      <h3>Mapping: {sourceName}</h3>
      <p className="source-hint">
        Match each application to its row in this source. Suggestions come from the names and are applied only when you
        save.
      </p>
      {error ? <p className="github-import-state github-import-state-error">{error}</p> : null}
      <datalist id={`source-keys-${sourceId}`}>
        {keys.map((key) => (
          <option key={key} value={key} />
        ))}
      </datalist>
      <table className="source-mapping-table">
        <thead>
          <tr>
            <th>Application</th>
            <th>Key in {sourceName}</th>
            <th>No match</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.applicationId}>
              <td>{row.name}</td>
              <td>
                <input
                  className="github-import-search-input"
                  list={`source-keys-${sourceId}`}
                  value={row.sourceKey}
                  disabled={row.noMatch}
                  onChange={(event) => change(row.applicationId, { sourceKey: event.target.value })}
                  aria-label={`Key for ${row.name}`}
                />
                {row.suggested ? <span className="source-hint"> suggested</span> : null}
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={row.noMatch}
                  onChange={(event) => change(row.applicationId, { noMatch: event.target.checked })}
                  aria-label={`No match for ${row.name}`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="source-actions">
        <button type="button" className="github-import-btn" disabled={busy} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Save and sync'}
        </button>
        <button type="button" className="github-import-btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </section>
  );
}

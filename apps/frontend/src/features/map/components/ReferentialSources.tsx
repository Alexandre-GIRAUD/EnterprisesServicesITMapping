import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { getDataModelRequest } from '@/features/datamodel/api/dataModelApi';
import type { ApplicationResponse, DataModelFieldDto, ReferentialSyncResult, ReferentialView } from '@/types/api';
import {
  createReferential,
  deleteReferential,
  listReferentials,
  probeReferential,
  proposeReferentialMappings,
  replaceReferentialIdentities,
  replaceReferentialMappings,
  setReferentialSecret,
  syncReferential,
  updateReferential,
} from '../api/referentialApi';

type ReferentialSourcesProps = {
  applications: ApplicationResponse[];
};

type IdentityDraft = { applicationId: string; externalKey: string };
type MappingDraft = { path: string; fieldKey: string };

const EMPTY_SYNC: ReferentialSyncResult = { results: [], errors: [] };

export function ReferentialSources({ applications }: ReferentialSourcesProps) {
  const { isAdmin } = useAuth();
  const [referentials, setReferentials] = useState<ReferentialView[]>([]);
  const [nodeFields, setNodeFields] = useState<DataModelFieldDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [urlTemplate, setUrlTemplate] = useState('https://');
  const [headerName, setHeaderName] = useState('');
  const [secret, setSecret] = useState('');
  const [identities, setIdentities] = useState<IdentityDraft[]>([]);
  const [mappings, setMappings] = useState<MappingDraft[]>([]);
  const [probeApplicationId, setProbeApplicationId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncResult, setSyncResult] = useState<ReferentialSyncResult>(EMPTY_SYNC);

  const selected = referentials.find((referential) => referential.id === selectedId) ?? null;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [listed, model] = await Promise.all([listReferentials(), getDataModelRequest()]);
        if (cancelled) return;
        setReferentials(listed);
        setNodeFields(model.fields.filter((field) => (field.target ?? 'EDGE') === 'NODE'));
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Unable to load referentials.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applicationName = useMemo(() => {
    const names = new Map<string, string>();
    for (const application of applications) names.set(application.id, application.name);
    return names;
  }, [applications]);

  function applySelection(referential: ReferentialView | null) {
    setSelectedId(referential?.id ?? null);
    setName(referential?.name ?? '');
    setUrlTemplate(referential?.urlTemplate ?? 'https://');
    setHeaderName(referential?.headerName ?? '');
    setSecret('');
    setIdentities(referential?.identities.map((identity) => ({ ...identity })) ?? []);
    setMappings(referential?.mappings.map((mapping) => ({ ...mapping })) ?? []);
    setProbeApplicationId(referential?.identities[0]?.applicationId ?? '');
    setSyncResult(EMPTY_SYNC);
  }

  async function reload(nextId?: string) {
    const [listed, model] = await Promise.all([listReferentials(), getDataModelRequest()]);
    setReferentials(listed);
    setNodeFields(model.fields.filter((field) => (field.target ?? 'EDGE') === 'NODE'));
    const current = listed.find((referential) => referential.id === (nextId ?? selectedId)) ?? null;
    if (current) applySelection(current);
    return listed;
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Referential request failed.');
    } finally {
      setBusy(false);
    }
  }

  function updateIdentity(index: number, patch: Partial<IdentityDraft>) {
    setIdentities(identities.map((identity, item) => (item === index ? { ...identity, ...patch } : identity)));
  }

  function updateMapping(index: number, patch: Partial<MappingDraft>) {
    setMappings(mappings.map((mapping, item) => (item === index ? { ...mapping, ...patch } : mapping)));
  }

  return (
    <div className="referential-sources">
      <p className="github-import-subtitle">
        An HTTPS API that fills Application attributes. Call it with the external key, then map each response field
        onto a Data Model attribute.
      </p>
      {error ? <p className="github-import-state github-import-state-error">{error}</p> : null}
      {message ? <p className="referential-message">{message}</p> : null}

      <div className="referential-layout">
        <div className="referential-list">
          {referentials.map((referential) => (
            <button
              key={referential.id}
              type="button"
              className={`referential-list-item${referential.id === selectedId ? ' is-active' : ''}`}
              onClick={() => applySelection(referential)}
            >
              {referential.name}
            </button>
          ))}
          {isAdmin ? (
            <button type="button" className="github-import-primary" onClick={() => applySelection(null)}>
              New referential
            </button>
          ) : null}
        </div>

        <form
          className="referential-form"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              const body = { name: name.trim(), urlTemplate: urlTemplate.trim(), headerName: headerName.trim() };
              const saved = selected
                ? await updateReferential(selected.id, body)
                : await createReferential(body);
              await reload(saved.id);
              setMessage(selected ? 'Referential updated.' : 'Referential created.');
            });
          }}
        >
          <label className="github-import-search-label">
            <span className="github-import-search-span">Name</span>
            <input className="github-import-search-input" value={name} onChange={(event) => setName(event.target.value)} required disabled={!isAdmin || busy} />
          </label>
          <label className="github-import-search-label">
            <span className="github-import-search-span">URL template</span>
            <input
              className="github-import-search-input"
              value={urlTemplate}
              onChange={(event) => setUrlTemplate(event.target.value)}
              placeholder="https://cmdb.example/apps/{externalKey}"
              required
              disabled={!isAdmin || busy}
            />
          </label>
          <label className="github-import-search-label">
            <span className="github-import-search-span">Header name</span>
            <input className="github-import-search-input" value={headerName} onChange={(event) => setHeaderName(event.target.value)} disabled={!isAdmin || busy} />
          </label>
          {isAdmin ? (
            <button type="submit" className="github-import-primary" disabled={busy}>
              {selected ? 'Save referential' : 'Create referential'}
            </button>
          ) : null}
        </form>
      </div>

      {selected ? (
        <>
          <section className="referential-section">
            <h2>Secret</h2>
            <p>{selected.secretConfigured ? 'A secret is stored.' : 'No secret stored yet.'}</p>
            {isAdmin ? (
              <div className="referential-inline">
                <input
                  className="github-import-search-input"
                  type="password"
                  value={secret}
                  autoComplete="off"
                  aria-label="Referential secret"
                  onChange={(event) => setSecret(event.target.value)}
                  disabled={busy}
                />
                <button
                  type="button"
                  className="github-import-primary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await setReferentialSecret(selected.id, secret);
                      setSecret('');
                      await reload(selected.id);
                      setMessage('Secret updated.');
                    })
                  }
                >
                  Save secret
                </button>
                <button
                  type="button"
                  disabled={busy || !selected.secretConfigured}
                  onClick={() =>
                    void run(async () => {
                      await setReferentialSecret(selected.id, '');
                      await reload(selected.id);
                      setMessage('Secret cleared.');
                    })
                  }
                >
                  Clear secret
                </button>
              </div>
            ) : null}
          </section>

          <section className="referential-section">
            <h2>External keys</h2>
            {identities.map((identity, index) => (
              <div className="referential-inline" key={`${identity.applicationId}-${index}`}>
                <select
                  className="github-import-filters"
                  aria-label="Application"
                  value={identity.applicationId}
                  disabled={!isAdmin || busy}
                  onChange={(event) => updateIdentity(index, { applicationId: event.target.value })}
                >
                  <option value="">Choose an application</option>
                  {applications.map((application) => (
                    <option key={application.id} value={application.id}>
                      {application.name}
                    </option>
                  ))}
                </select>
                <input
                  className="github-import-search-input"
                  aria-label="External key"
                  value={identity.externalKey}
                  disabled={!isAdmin || busy}
                  onChange={(event) => updateIdentity(index, { externalKey: event.target.value })}
                />
                {isAdmin ? (
                  <>
                    <button
                      type="button"
                      disabled={busy || !identity.applicationId}
                      onClick={() =>
                        updateIdentity(index, { externalKey: applicationName.get(identity.applicationId) ?? '' })
                      }
                    >
                      Copy name
                    </button>
                    <button type="button" disabled={busy} onClick={() => setIdentities(identities.filter((_, item) => item !== index))}>
                      Remove
                    </button>
                  </>
                ) : null}
              </div>
            ))}
            {isAdmin ? (
              <div className="referential-inline">
                <button type="button" disabled={busy} onClick={() => setIdentities([...identities, { applicationId: '', externalKey: '' }])}>
                  Add application
                </button>
                <button
                  type="button"
                  className="github-import-primary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await replaceReferentialIdentities(selected.id, identities);
                      await reload(selected.id);
                      setMessage('External keys saved.');
                    })
                  }
                >
                  Save external keys
                </button>
              </div>
            ) : null}
          </section>

          <section className="referential-section">
            <h2>Field mappings</h2>
            {mappings.map((mapping, index) => (
              <div className="referential-inline" key={`${mapping.fieldKey}-${index}`}>
                <input
                  className="github-import-search-input"
                  aria-label="Response path"
                  value={mapping.path}
                  placeholder="owner or team.lead"
                  disabled={!isAdmin || busy}
                  onChange={(event) => updateMapping(index, { path: event.target.value })}
                />
                <select
                  className="github-import-filters"
                  aria-label="Data Model attribute"
                  value={mapping.fieldKey}
                  disabled={!isAdmin || busy}
                  onChange={(event) => updateMapping(index, { fieldKey: event.target.value })}
                >
                  <option value="">Choose an attribute</option>
                  {nodeFields.map((field) => (
                    <option key={field.key} value={field.key}>
                      {field.label || field.key}
                    </option>
                  ))}
                </select>
                {isAdmin ? (
                  <button type="button" disabled={busy} onClick={() => setMappings(mappings.filter((_, item) => item !== index))}>
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
            {isAdmin ? (
              <div className="referential-inline">
                <button type="button" disabled={busy} onClick={() => setMappings([...mappings, { path: '', fieldKey: '' }])}>
                  Add mapping
                </button>
                <button
                  type="button"
                  className="github-import-primary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await replaceReferentialMappings(selected.id, mappings);
                      await reload(selected.id);
                      setMessage('Mappings saved.');
                    })
                  }
                >
                  Save mappings
                </button>
              </div>
            ) : null}
          </section>

          {isAdmin ? (
            <section className="referential-section">
              <h2>Call</h2>
              <div className="referential-inline">
                <select
                  className="github-import-filters"
                  aria-label="Application to call"
                  value={probeApplicationId}
                  disabled={busy}
                  onChange={(event) => setProbeApplicationId(event.target.value)}
                >
                  <option value="">Choose an application</option>
                  {identities.map((identity) => (
                    <option key={identity.applicationId} value={identity.applicationId}>
                      {applicationName.get(identity.applicationId) ?? identity.applicationId}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={busy || !probeApplicationId}
                  onClick={() =>
                    void run(async () => {
                      const result = await probeReferential(selected.id, probeApplicationId);
                      await reload(selected.id);
                      setMessage(result.success ? 'Sample stored.' : result.message);
                      if (!result.success) setError(result.message);
                    })
                  }
                >
                  Probe
                </button>
                <button
                  type="button"
                  disabled={busy || !selected.samplePreview}
                  onClick={() =>
                    void run(async () => {
                      const suggested = await proposeReferentialMappings(selected.id);
                      setMappings(suggested);
                      setMessage('Review the proposal, then save mappings.');
                    })
                  }
                >
                  Propose mappings
                </button>
                <button
                  type="button"
                  disabled={busy || !probeApplicationId}
                  onClick={() =>
                    void run(async () => {
                      setSyncResult(await syncReferential(selected.id, probeApplicationId));
                      setMessage('Sync finished.');
                    })
                  }
                >
                  Sync this application
                </button>
                <button
                  type="button"
                  className="github-import-primary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      setSyncResult(await syncReferential(selected.id));
                      setMessage('Sync finished.');
                    })
                  }
                >
                  Sync all
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await deleteReferential(selected.id);
                      setReferentials(await listReferentials());
                      applySelection(null);
                      setMessage('Referential deleted. Stored attribute values were kept.');
                    })
                  }
                >
                  Delete referential
                </button>
              </div>
              {selected.samplePreview ? <pre className="referential-sample">{selected.samplePreview}</pre> : null}
              {syncResult.errors.map((item) => (
                <p key={item} className="github-import-state github-import-state-error">
                  {item}
                </p>
              ))}
              {syncResult.results.length > 0 ? (
                <ul className="referential-results">
                  {syncResult.results.map((item) => (
                    <li key={`${item.applicationId}-${item.fieldKey}`}>
                      {applicationName.get(item.applicationId) ?? item.applicationId} · {item.fieldKey} · {item.status}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

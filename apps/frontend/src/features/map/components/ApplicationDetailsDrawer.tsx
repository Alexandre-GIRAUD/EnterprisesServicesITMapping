import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  ApplicationRequest,
  ApplicationResponse,
  DataModelFieldDto,
  GraphNodeFilterDto,
} from '@/types/api';
import { getDataModelRequest } from '@/features/datamodel/api/dataModelApi';
import {
  deleteApplicationById,
  fetchApplicationById,
  patchApplicationNodeAttributes,
  patchApplicationNodeRefs,
  suggestConnectionsFromGithub,
  suggestModulesFromGithub,
  updateApplicationById,
} from '../api/applicationsApi';
import { fetchGraphNodeFilters } from '../api/graphApi';
import { moduleGraphMapState } from '../utils/mapNavigation';
import { isGitHubLinkedApplication } from '../utils/githubLinkedApplication';
import { isSandboxId } from '../utils/sandboxGraph';

type ApplicationDetails = {
  id: string;
  label: string;
};

export type ApplicationUpdatePatch = {
  name: string;
  description?: string;
};

type ApplicationDetailsDrawerProps = {
  isOpen: boolean;
  application: ApplicationDetails | null;
  onClose: () => void;
  sandboxMode?: boolean;
  /** Resolve sandbox-only application details from the local graph. */
  resolveSandboxApplication?: (id: string) => ApplicationResponse | null;
  onApplicationUpdated?: (applicationId: string, patch: ApplicationUpdatePatch) => void;
  onOpenModuleGraph: (applicationId: string) => void;
  /** Invoked after backend delete succeeds; parent should remove the node from the graph and close UI. */
  onApplicationDeleted: (applicationId: string) => void;
};

function attributeValues(
  fields: DataModelFieldDto[],
  attributes: Record<string, string> | undefined
): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.key, attributes?.[f.key] ?? '']));
}

function refIdValues(
  fields: DataModelFieldDto[],
  nodeRefs: ApplicationResponse['nodeRefs'] | undefined
): Record<string, string[]> {
  return Object.fromEntries(
    fields.map((f) => [f.key, (nodeRefs?.[f.key] ?? []).map((r) => r.id)])
  );
}

export function ApplicationDetailsDrawer({
  isOpen,
  application,
  onClose,
  sandboxMode = false,
  resolveSandboxApplication,
  onApplicationUpdated,
  onOpenModuleGraph,
  onApplicationDeleted,
}: ApplicationDetailsDrawerProps) {
  const [details, setDetails] = useState<ApplicationResponse | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [suggestErrorMessage, setSuggestErrorMessage] = useState<string | null>(null);
  const [suggestSuccessMessage, setSuggestSuccessMessage] = useState<string | null>(null);
  const [connBusy, setConnBusy] = useState(false);
  const [connErrorMessage, setConnErrorMessage] = useState<string | null>(null);
  const [connSuccessMessage, setConnSuccessMessage] = useState<string | null>(null);
  const [nodeFields, setNodeFields] = useState<DataModelFieldDto[]>([]);
  const [nodeRefFields, setNodeRefFields] = useState<DataModelFieldDto[]>([]);
  const [nodeRefOptions, setNodeRefOptions] = useState<Record<string, GraphNodeFilterDto>>({});
  const [formState, setFormState] = useState({ name: '', description: '' });
  const [attributeForm, setAttributeForm] = useState<Record<string, string>>({});
  const [refForm, setRefForm] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void Promise.all([getDataModelRequest(), fetchGraphNodeFilters()])
      .then(([data, filters]) => {
        if (cancelled) return;
        setNodeFields(data.fields.filter((f) => f.target === 'NODE'));
        setNodeRefFields(data.fields.filter((f) => f.target === 'NODE_REF'));
        const byKey: Record<string, GraphNodeFilterDto> = {};
        for (const filter of filters) {
          if (filter.kind === 'NODE_REF') {
            byKey[filter.key] = filter;
          }
        }
        setNodeRefOptions(byKey);
      })
      .catch(() => {
        if (!cancelled) {
          setNodeFields([]);
          setNodeRefFields([]);
          setNodeRefOptions({});
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !application?.id) return;
    let cancelled = false;
    setStatus('loading');
    setErrorMessage(null);
    setSaveSuccessMessage(null);
    setFormErrorMessage(null);
    setSuggestErrorMessage(null);
    setSuggestSuccessMessage(null);
    setConnErrorMessage(null);
    setConnSuccessMessage(null);

    if (sandboxMode && isSandboxId(application.id)) {
      const local = resolveSandboxApplication?.(application.id);
      if (!local) {
        setStatus('error');
        setErrorMessage('Sandbox application not found on the graph.');
        return;
      }
      setDetails(local);
      setFormState({ name: local.name ?? '', description: local.description ?? '' });
      setStatus('ready');
      return;
    }

    void fetchApplicationById(application.id)
      .then((data) => {
        if (cancelled) return;
        setDetails(data);
        setFormState({ name: data.name ?? '', description: data.description ?? '' });
        setStatus('ready');
      })
      .catch((e) => {
        if (cancelled) return;
        setStatus('error');
        setErrorMessage(e instanceof Error ? e.message : 'Unable to load details');
      });

    return () => {
      cancelled = true;
    };
  }, [application?.id, isOpen, resolveSandboxApplication, sandboxMode]);

  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
      setIsSaving(false);
      setSaveSuccessMessage(null);
      setFormErrorMessage(null);
      setShowDeleteConfirm(false);
      setDeleteErrorMessage(null);
      setIsDeleting(false);
      setSuggestBusy(false);
      setSuggestErrorMessage(null);
      setSuggestSuccessMessage(null);
      setConnBusy(false);
      setConnErrorMessage(null);
      setConnSuccessMessage(null);
    }
  }, [isOpen]);

  const description =
    details?.description && details.description.trim().length > 0
      ? details.description
      : 'No description provided.';

  /** Data Model NODE fields plus any stored attribute whose field was since removed. */
  const readOnlyAttributes = useMemo(() => {
    const stored = details?.nodeAttributes ?? {};
    const rows = nodeFields.map((field) => ({
      key: field.key,
      label: field.label || field.key,
      value: stored[field.key] ?? '',
    }));
    const known = new Set(nodeFields.map((f) => f.key));
    for (const [key, value] of Object.entries(stored)) {
      if (!known.has(key)) {
        rows.push({ key, label: key, value });
      }
    }
    return rows;
  }, [details?.nodeAttributes, nodeFields]);

  const readOnlyRefs = useMemo(() => {
    const stored = details?.nodeRefs ?? {};
    return nodeRefFields.map((field) => ({
      key: field.key,
      label: field.label || field.key,
      value: (stored[field.key] ?? []).map((r) => r.name || r.value || r.id).join(', '),
    }));
  }, [details?.nodeRefs, nodeRefFields]);

  function startEditing(source: ApplicationResponse) {
    setFormErrorMessage(null);
    setSaveSuccessMessage(null);
    setShowDeleteConfirm(false);
    setDeleteErrorMessage(null);
    setFormState({ name: source.name ?? '', description: source.description ?? '' });
    setAttributeForm(attributeValues(nodeFields, source.nodeAttributes));
    setRefForm(refIdValues(nodeRefFields, source.nodeRefs));
    setIsEditing(true);
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!application?.id || !details) return;

    const name = formState.name.trim();
    if (!name) {
      setFormErrorMessage('The name field is required.');
      return;
    }

    const missing = nodeFields.find(
      (field) => field.required && !(attributeForm[field.key] ?? '').trim()
    );
    if (missing) {
      setFormErrorMessage(`${missing.label || missing.key} is required.`);
      return;
    }
    const missingRef = nodeRefFields.find(
      (field) => field.required && (refForm[field.key] ?? []).length === 0
    );
    if (missingRef) {
      setFormErrorMessage(`${missingRef.label || missingRef.key} is required.`);
      return;
    }

    const payload: ApplicationRequest = {
      name,
      description: formState.description.trim() || '',
    };
    const attributes = Object.fromEntries(
      nodeFields.map((field) => [field.key, (attributeForm[field.key] ?? '').trim()])
    );
    const refs = Object.fromEntries(
      nodeRefFields.map((field) => [field.key, refForm[field.key] ?? []])
    );

    if (sandboxMode) {
      try {
        setIsSaving(true);
        setFormErrorMessage(null);
        setSaveSuccessMessage(null);
        const updated: ApplicationResponse = {
          ...details,
          id: application.id,
          name,
          description: payload.description,
          nodeAttributes: Object.fromEntries(
            Object.entries(attributes).filter(([, value]) => value.length > 0)
          ),
          nodeRefs: Object.fromEntries(
            nodeRefFields
              .map((field) => {
                const ids = refs[field.key] ?? [];
                const options = nodeRefOptions[field.key]?.options ?? [];
                return [
                  field.key,
                  ids.map((id) => {
                    const opt = options.find((o) => o.id === id);
                    return { id, name: opt?.name ?? id, value: opt?.name ?? id };
                  }),
                ] as const;
              })
              .filter(([, list]) => list.length > 0)
          ),
        };
        setDetails(updated);
        setFormState({ name: updated.name ?? '', description: updated.description ?? '' });
        onApplicationUpdated?.(application.id, { name, description: payload.description });
        setSaveSuccessMessage('Application updated (sandbox, not saved).');
        setIsEditing(false);
      } finally {
        setIsSaving(false);
      }
      return;
    }

    try {
      setIsSaving(true);
      setFormErrorMessage(null);
      setSaveSuccessMessage(null);
      await updateApplicationById(application.id, payload);
      if (nodeFields.length > 0) {
        await patchApplicationNodeAttributes(application.id, attributes);
      }
      if (nodeRefFields.length > 0) {
        await patchApplicationNodeRefs(application.id, refs);
      }
      const refreshed = await fetchApplicationById(application.id);
      setDetails(refreshed);
      setFormState({ name: refreshed.name ?? '', description: refreshed.description ?? '' });
      setAttributeForm(attributeValues(nodeFields, refreshed.nodeAttributes));
      setRefForm(refIdValues(nodeRefFields, refreshed.nodeRefs));
      onApplicationUpdated?.(application.id, {
        name: refreshed.name ?? name,
        description: refreshed.description,
      });
      setSaveSuccessMessage('Application updated.');
      setIsEditing(false);
    } catch (e) {
      setFormErrorMessage(e instanceof Error ? e.message : 'Unable to save changes.');
    } finally {
      setIsSaving(false);
    }
  }

  function onCancelEdit() {
    if (!details) {
      setIsEditing(false);
      return;
    }
    setFormState({ name: details.name ?? '', description: details.description ?? '' });
    setAttributeForm(attributeValues(nodeFields, details.nodeAttributes));
    setRefForm(refIdValues(nodeRefFields, details.nodeRefs));
    setFormErrorMessage(null);
    setSaveSuccessMessage(null);
    setShowDeleteConfirm(false);
    setDeleteErrorMessage(null);
    setIsEditing(false);
  }

  async function onSuggestModulesFromGithub() {
    const id = application?.id;
    if (!id || !details) return;
    setSuggestErrorMessage(null);
    setSuggestSuccessMessage(null);
    try {
      setSuggestBusy(true);
      const res = await suggestModulesFromGithub(id);
      setDetails(await fetchApplicationById(id));
      setSuggestSuccessMessage(
        `${res.created.length} module(s) created. ${res.skipped.length} entry(ies) skipped.`
      );
    } catch (e) {
      setSuggestErrorMessage(e instanceof Error ? e.message : 'AI module suggestion failed.');
    } finally {
      setSuggestBusy(false);
    }
  }

  async function onSuggestConnectionsFromGithub() {
    const id = application?.id;
    if (!id || !details) return;
    setConnErrorMessage(null);
    setConnSuccessMessage(null);
    try {
      setConnBusy(true);
      const res = await suggestConnectionsFromGithub(id);
      const outbound = res.created.filter((c) => c.direction === 'outbound').length;
      const inbound = res.created.length - outbound;
      setConnSuccessMessage(
        `${res.created.length} connexion(s) créée(s) (${outbound} sortante(s), ${inbound} entrante(s)). ${res.skipped.length} ignorée(s).`
      );
      setDetails(await fetchApplicationById(id));
    } catch (e) {
      setConnErrorMessage(e instanceof Error ? e.message : 'AI connection suggestion failed.');
    } finally {
      setConnBusy(false);
    }
  }

  async function onConfirmDelete() {
    const id = application?.id;
    if (!id) return;
    try {
      setIsDeleting(true);
      setDeleteErrorMessage(null);
      if (!sandboxMode) {
        await deleteApplicationById(id);
      }
      onApplicationDeleted(id);
      setShowDeleteConfirm(false);
    } catch (e) {
      setDeleteErrorMessage(
        e instanceof Error ? e.message : 'Unable to delete this application.'
      );
    } finally {
      setIsDeleting(false);
    }
  }

  function renderAttributeInput(field: DataModelFieldDto) {
    const value = attributeForm[field.key] ?? '';
    const allowed = field.allowedValues ?? [];
    const onChange = (next: string) =>
      setAttributeForm((prev) => ({ ...prev, [field.key]: next }));

    return (
      <label className="graph-drawer-field" key={field.key}>
        <span className="graph-drawer-field-label">{field.label || field.key}</span>
        {allowed.length > 0 ? (
          <select
            className="graph-drawer-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={isSaving || isDeleting}
          >
            <option value="">Not set</option>
            {allowed.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            {value && !allowed.includes(value) ? (
              <option value={value}>{value} (current)</option>
            ) : null}
          </select>
        ) : (
          <input
            className="graph-drawer-input"
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={isSaving || isDeleting}
          />
        )}
        {field.description ? (
          <span className="graph-drawer-field-hint">{field.description}</span>
        ) : null}
      </label>
    );
  }

  function renderRefInput(field: DataModelFieldDto) {
    const selected = refForm[field.key] ?? [];
    const options = nodeRefOptions[field.key]?.options ?? [];
    const multiple = Boolean(field.multiple);

    if (multiple) {
      return (
        <fieldset className="graph-drawer-field graph-drawer-fieldset" key={field.key}>
          <legend className="graph-drawer-field-label">{field.label || field.key}</legend>
          {options.length === 0 ? (
            <p className="graph-drawer-field-hint">
              No active catalogue value. Add values in the Data Model, then save.
            </p>
          ) : (
            <div className="graph-drawer-region-checkboxes">
              {options.map((option) => {
                const checked = selected.includes(option.id);
                return (
                  <label key={option.id} className="graph-drawer-checkbox-row">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isSaving || isDeleting}
                      onChange={() => {
                        setRefForm((prev) => {
                          const current = prev[field.key] ?? [];
                          const next = checked
                            ? current.filter((id) => id !== option.id)
                            : [...current, option.id];
                          return { ...prev, [field.key]: next };
                        });
                      }}
                    />
                    <span>{option.name}</span>
                  </label>
                );
              })}
            </div>
          )}
          {field.description ? (
            <span className="graph-drawer-field-hint">{field.description}</span>
          ) : null}
        </fieldset>
      );
    }

    const value = selected[0] ?? '';
    return (
      <label className="graph-drawer-field" key={field.key}>
        <span className="graph-drawer-field-label">{field.label || field.key}</span>
        <select
          className="graph-drawer-input"
          value={value}
          onChange={(e) =>
            setRefForm((prev) => ({
              ...prev,
              [field.key]: e.target.value ? [e.target.value] : [],
            }))
          }
          disabled={isSaving || isDeleting}
        >
          <option value="">Not set</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
          {value && !options.some((o) => o.id === value) ? (
            <option value={value}>{value} (current)</option>
          ) : null}
        </select>
        {field.description ? (
          <span className="graph-drawer-field-hint">{field.description}</span>
        ) : null}
      </label>
    );
  }

  return (
    <aside
      className={`graph-details-drawer${isOpen ? ' is-open' : ''}`}
      aria-label="Application details panel"
    >
      <header className="graph-details-header">
        <p className="graph-drawer-eyebrow">Application</p>
        <div className="graph-drawer-title-row">
          <div className="graph-details-header-main">
            <h2 className="graph-drawer-title" title={application?.label}>
              {application?.label ?? 'Details'}
            </h2>
            {application?.id && (
              <p className="graph-details-id" title={application.id}>
                {application.id}
              </p>
            )}
          </div>
          <button
            type="button"
            className="graph-drawer-close"
            onClick={onClose}
            aria-label="Close application details"
          >
            x
          </button>
        </div>
      </header>

      <div className="graph-details-content">
        {status === 'loading' && <p className="graph-details-text">Loading...</p>}
        {status === 'error' && (
          <p className="graph-details-text graph-details-text-error">
            {errorMessage ?? 'Unable to load details.'}
          </p>
        )}
        {status === 'ready' && (
          <>
            {!isEditing ? (
              <>
                {saveSuccessMessage && (
                  <p className="graph-drawer-feedback graph-drawer-feedback-success" role="status">
                    {saveSuccessMessage}
                  </p>
                )}
                <section className="graph-details-section">
                  <h3 className="graph-details-section-title">Description</h3>
                  <p className="graph-details-text">{description}</p>
                </section>

                <section className="graph-details-section">
                  <h3 className="graph-details-section-title">Attributes</h3>
                  {readOnlyAttributes.length === 0 ? (
                    <p className="graph-details-text">
                      No application attribute configured. Add Data Model fields targeting
                      Application (node) to describe this application.
                    </p>
                  ) : (
                    <dl className="graph-details-attribute-list">
                      {readOnlyAttributes.map((row) => (
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

                {nodeRefFields.length > 0 ? (
                  <section className="graph-details-section">
                    <h3 className="graph-details-section-title">References</h3>
                    <dl className="graph-details-attribute-list">
                      {readOnlyRefs.map((row) => (
                        <div className="graph-details-attribute-row" key={row.key}>
                          <dt className="graph-details-attribute-label">{row.label}</dt>
                          <dd className="graph-details-text">
                            {row.value.trim() ? row.value : 'Not provided'}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ) : null}
              </>
            ) : (
              <form className="graph-drawer-form" onSubmit={onSave}>
                <label className="graph-drawer-field">
                  <span className="graph-drawer-field-label">Name</span>
                  <input
                    className="graph-drawer-input"
                    type="text"
                    value={formState.name}
                    onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                    disabled={isSaving || isDeleting}
                    required
                  />
                </label>
                <label className="graph-drawer-field">
                  <span className="graph-drawer-field-label">Description</span>
                  <textarea
                    className="graph-drawer-input graph-drawer-textarea"
                    value={formState.description}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, description: e.target.value }))
                    }
                    rows={3}
                    disabled={isSaving || isDeleting}
                  />
                </label>

                {nodeFields.length > 0 ? (
                  <fieldset className="graph-drawer-field graph-drawer-fieldset">
                    <legend className="graph-drawer-field-label">Attributes</legend>
                    {nodeFields.map((field) => renderAttributeInput(field))}
                    <p className="graph-drawer-field-hint">
                      Defined in the Data Model. Leave empty to clear the value.
                    </p>
                  </fieldset>
                ) : (
                  <p className="graph-details-text">
                    No application attribute configured in the Data Model.
                  </p>
                )}

                {nodeRefFields.length > 0 ? (
                  <fieldset className="graph-drawer-field graph-drawer-fieldset">
                    <legend className="graph-drawer-field-label">References</legend>
                    {nodeRefFields.map((field) => renderRefInput(field))}
                    <p className="graph-drawer-field-hint">
                      Catalogue values from the Data Model. Clear selection to remove links.
                    </p>
                  </fieldset>
                ) : null}

                {formErrorMessage && (
                  <p className="graph-drawer-feedback graph-drawer-feedback-error" role="alert">
                    {formErrorMessage}
                  </p>
                )}
                <div className="graph-drawer-form-actions">
                  <button
                    type="submit"
                    className="graph-drawer-action graph-drawer-action-primary"
                    disabled={isSaving || isDeleting}
                  >
                    <span className="graph-drawer-action-title">
                      {isSaving ? 'Saving…' : 'Save'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="graph-drawer-action"
                    onClick={onCancelEdit}
                    disabled={isSaving || isDeleting}
                  >
                    <span className="graph-drawer-action-title">Cancel</span>
                  </button>
                </div>
                {!showDeleteConfirm ? (
                  <button
                    type="button"
                    className="graph-drawer-action graph-drawer-action-danger"
                    disabled={isSaving || isDeleting}
                    onClick={() => {
                      setDeleteErrorMessage(null);
                      setShowDeleteConfirm(true);
                    }}
                  >
                    <span className="graph-drawer-action-title">Delete application</span>
                    <span className="graph-drawer-action-meta" aria-hidden="true">
                      {sandboxMode ? 'Local' : 'Neo4j'}
                    </span>
                  </button>
                ) : (
                  <div
                    className="graph-details-delete-confirm"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="graph-delete-confirm-title"
                  >
                    <p
                      id="graph-delete-confirm-title"
                      className="graph-details-delete-confirm-title"
                    >
                      {sandboxMode
                        ? 'Remove this application from the sandbox graph? No database data will be changed.'
                        : 'Delete this application? Modules linked via CONTAINS and attached edges will be permanently removed.'}
                    </p>
                    <div className="graph-details-delete-confirm-actions">
                      <button
                        type="button"
                        className="graph-drawer-action graph-drawer-action-danger-solid"
                        disabled={isDeleting}
                        onClick={() => void onConfirmDelete()}
                      >
                        <span className="graph-drawer-action-title">
                          {isDeleting ? 'Deleting…' : 'Confirm deletion'}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="graph-drawer-action"
                        disabled={isDeleting}
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeleteErrorMessage(null);
                        }}
                      >
                        <span className="graph-drawer-action-title">Cancel</span>
                      </button>
                    </div>
                  </div>
                )}
                {deleteErrorMessage && (
                  <p className="graph-drawer-feedback graph-drawer-feedback-error" role="alert">
                    {deleteErrorMessage}
                  </p>
                )}
              </form>
            )}
          </>
        )}
      </div>

      <div className="graph-details-actions">
        {suggestErrorMessage && (
          <p className="graph-drawer-feedback graph-drawer-feedback-error" role="alert">
            {suggestErrorMessage}
          </p>
        )}
        {suggestSuccessMessage && (
          <p
            className="graph-drawer-feedback graph-drawer-feedback-success"
            role="status"
            aria-live="polite"
          >
            {suggestSuccessMessage}{' '}
            {application?.id ? (
              <Link
                className="github-import-inline-link"
                to="/map"
                state={moduleGraphMapState(application.id, details?.name ?? application.label)}
              >
                View module graph
              </Link>
            ) : null}
          </p>
        )}
        {application?.id &&
          status === 'ready' &&
          !isEditing &&
          details &&
          !sandboxMode &&
          isGitHubLinkedApplication(details) && (
            <button
              type="button"
              className="graph-drawer-action"
              disabled={suggestBusy || isDeleting || Boolean(details.hasModuleSubtree)}
              title={
                details.hasModuleSubtree
                  ? 'Modules are already linked to this application. AI suggestion cannot be run again.'
                  : undefined
              }
              aria-busy={suggestBusy}
              onClick={() => void onSuggestModulesFromGithub()}
            >
              <span className="graph-drawer-action-title">
                {suggestBusy
                  ? 'AI analysis…'
                  : details.hasModuleSubtree
                    ? 'Modules already in place'
                    : 'Suggest modules (AI)'}
              </span>
            </button>
          )}
        {connErrorMessage && (
          <p className="graph-drawer-feedback graph-drawer-feedback-error" role="alert">
            {connErrorMessage}
          </p>
        )}
        {connSuccessMessage && (
          <p
            className="graph-drawer-feedback graph-drawer-feedback-success"
            role="status"
            aria-live="polite"
          >
            {connSuccessMessage}
          </p>
        )}
        {application?.id &&
          status === 'ready' &&
          !isEditing &&
          details &&
          !sandboxMode &&
          isGitHubLinkedApplication(details) && (
            <button
              type="button"
              className="graph-drawer-action"
              disabled={connBusy || suggestBusy || isDeleting}
              aria-busy={connBusy}
              onClick={() => void onSuggestConnectionsFromGithub()}
            >
              <span className="graph-drawer-action-title">
                {connBusy ? 'Analyse des connexions…' : 'Suggérer les connexions (IA)'}
              </span>
            </button>
          )}
        {application?.id && (
          <button
            type="button"
            className="graph-drawer-action graph-drawer-action-primary"
            disabled={sandboxMode}
            title={sandboxMode ? 'Unavailable in sandbox' : undefined}
            onClick={() => onOpenModuleGraph(application.id)}
          >
            <span className="graph-drawer-action-title">Open module graph</span>
          </button>
        )}
        {status === 'ready' && !isEditing && (
          <button
            type="button"
            className="graph-drawer-action"
            onClick={() => {
              if (!details) return;
              startEditing(details);
            }}
          >
            <span className="graph-drawer-action-title">Edit</span>
          </button>
        )}
      </div>
    </aside>
  );
}

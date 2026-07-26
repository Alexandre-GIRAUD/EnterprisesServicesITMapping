import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  ApplicationRequest,
  ApplicationResponse,
  BusinessUnitListItem,
  RegionSummary,
} from '@/types/api';
import {
  deleteApplicationById,
  fetchApplicationById,
  patchApplicationBusinessUnit,
  patchApplicationRegions,
  suggestConnectionsFromGithub,
  suggestModulesFromGithub,
  updateApplicationById,
} from '../api/applicationsApi';
import { fetchRegions } from '../api/regionsApi';
import { fetchBusinessUnits } from '../api/businessUnitsApi';
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
  year?: number | null;
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
  const [formState, setFormState] = useState({
    name: '',
    description: '',
    year: '',
    businessUnitId: '',
    regionCodes: [] as string[],
  });
  const [businessUnitsCatalog, setBusinessUnitsCatalog] = useState<BusinessUnitListItem[]>([]);
  const [regionsCatalog, setRegionsCatalog] = useState<RegionSummary[]>([]);

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
      setFormState({
        name: local.name ?? '',
        description: local.description ?? '',
        year: local.year != null ? String(local.year) : '',
        businessUnitId: '',
        regionCodes: [],
      });
      setStatus('ready');
      return;
    }

    void fetchApplicationById(application.id)
      .then((data) => {
        if (cancelled) return;
        setDetails(data);
        setFormState({
          name: data.name ?? '',
          description: data.description ?? '',
          year: data.year != null ? String(data.year) : '',
          businessUnitId: data.businessUnit?.id ?? '',
          regionCodes: regionCodesFromDetail(data),
        });
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
    if (!isEditing || !isOpen || sandboxMode) return;
    let cancelled = false;
    void fetchBusinessUnits()
      .then((rows) => {
        if (!cancelled) setBusinessUnitsCatalog(rows);
      })
      .catch(() => {
        if (!cancelled) setBusinessUnitsCatalog([]);
      });
    void fetchRegions()
      .then((rows) => {
        if (!cancelled) setRegionsCatalog(rows);
      })
      .catch(() => {
        if (!cancelled) setRegionsCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isEditing, isOpen, sandboxMode]);

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

  const yearText = useMemo(
    () => (details?.year != null ? String(details.year) : 'Not provided'),
    [details?.year]
  );

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!application?.id || !details) return;

    const name = formState.name.trim();
    if (!name) {
      setFormErrorMessage('The name field is required.');
      return;
    }

    const yearTrimmed = formState.year.trim();
    let yearValue: number | undefined;
    if (yearTrimmed) {
      const parsed = Number(yearTrimmed);
      if (!Number.isInteger(parsed) || parsed < 1970 || parsed > 2100) {
        setFormErrorMessage('Year must be a valid integer (1970–2100).');
        return;
      }
      yearValue = parsed;
    }

    const payload: ApplicationRequest = {
      name,
      description: formState.description.trim() || '',
      year: yearValue,
    };

    if (sandboxMode) {
      try {
        setIsSaving(true);
        setFormErrorMessage(null);
        setSaveSuccessMessage(null);
        const updated: ApplicationResponse = {
          ...(details ?? {
            id: application.id,
            name,
            year: yearValue ?? null,
          }),
          id: application.id,
          name,
          description: payload.description,
          year: yearValue ?? null,
        };
        setDetails(updated);
        setFormState({
          name: updated.name ?? '',
          description: updated.description ?? '',
          year: updated.year != null ? String(updated.year) : '',
          businessUnitId: formState.businessUnitId,
          regionCodes: formState.regionCodes,
        });
        onApplicationUpdated?.(application.id, {
          name,
          description: payload.description,
          year: yearValue ?? null,
        });
        setSaveSuccessMessage('Application updated (sandbox, not saved).');
        setIsEditing(false);
      } finally {
        setIsSaving(false);
      }
      return;
    }

    const buIdTrimmed = formState.businessUnitId.trim();
    const businessUnitIdPatch: string | null = buIdTrimmed.length > 0 ? buIdTrimmed : null;

    try {
      setIsSaving(true);
      setFormErrorMessage(null);
      setSaveSuccessMessage(null);
      await updateApplicationById(application.id, payload);
      await patchApplicationBusinessUnit(application.id, businessUnitIdPatch);
      await patchApplicationRegions(application.id, formState.regionCodes);
      const refreshed = await fetchApplicationById(application.id);
      setDetails(refreshed);
      setFormState({
        name: refreshed.name ?? '',
        description: refreshed.description ?? '',
        year: refreshed.year != null ? String(refreshed.year) : '',
        businessUnitId: refreshed.businessUnit?.id ?? '',
        regionCodes: regionCodesFromDetail(refreshed),
      });
      setSaveSuccessMessage('Application updated.');
      setIsEditing(false);
    } catch (e) {
      setFormErrorMessage(
        e instanceof Error ? e.message : 'Unable to save changes.'
      );
    } finally {
      setIsSaving(false);
    }
  }

  function onCancelEdit() {
    if (!details) {
      setIsEditing(false);
      return;
    }
    setFormState({
      name: details.name ?? '',
      description: details.description ?? '',
      year: details.year != null ? String(details.year) : '',
      businessUnitId: details.businessUnit?.id ?? '',
      regionCodes: regionCodesFromDetail(details),
    });
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
      setSuggestErrorMessage(
        e instanceof Error ? e.message : 'AI module suggestion failed.'
      );
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
    } catch (e) {
      setConnErrorMessage(
        e instanceof Error ? e.message : 'AI connection suggestion failed.'
      );
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
                <h3 className="graph-details-section-title">Business unit</h3>
                <p className="graph-details-text">
                  {details && details.businessUnit
                    ? `${details.businessUnit.name ?? '—'}${
                        details.businessUnit.code ? ` (${details.businessUnit.code})` : ''
                      }`
                    : 'Not linked to a business unit.'}
                </p>
              </section>

              <section className="graph-details-section">
                <h3 className="graph-details-section-title">Regions</h3>
                {details?.regions && details.regions.length > 0 ? (
                  <ul className="graph-details-region-list">
                    {details.regions.map((r) => (
                      <li key={r.id} className="graph-details-text">
                        <strong>{r.code}</strong>
                        {r.name ? ` — ${r.name}` : ''}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="graph-details-text">No regions provided.</p>
                )}
              </section>

              <section className="graph-details-section">
                <h3 className="graph-details-section-title">Year</h3>
                <p className="graph-details-text">{yearText}</p>
              </section>
            </>
          ) : (
            <form className="graph-drawer-form" onSubmit={onSave}>
              <label className="graph-drawer-field">
                <span className="graph-drawer-field-label">Name</span>
                <input
                  className="graph-drawer-input"
                  type="text"
                  value={formState.name}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, name: e.target.value }))
                  }
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
              <label className="graph-drawer-field">
                <span className="graph-drawer-field-label">Business unit</span>
                <select
                  className="graph-drawer-input"
                  value={formState.businessUnitId}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, businessUnitId: e.target.value }))
                  }
                  disabled={isSaving || isDeleting || sandboxMode}
                  aria-label="Application business unit"
                >
                  <option value="">None / not linked</option>
                  {businessUnitsCatalog.map((bu) => (
                    <option key={bu.id} value={bu.id}>
                      {bu.name}
                    </option>
                  ))}
                </select>
                {sandboxMode && (
                  <span className="graph-drawer-field-hint">Not editable in sandbox.</span>
                )}
              </label>
              <fieldset className="graph-drawer-field graph-drawer-fieldset" disabled={sandboxMode}>
                <legend className="graph-drawer-field-label">Regions</legend>
                {sandboxMode ? (
                  <p className="graph-details-text">Not editable in sandbox.</p>
                ) : regionsCatalog.length === 0 ? (
                  <p className="graph-details-text">Loading catalog…</p>
                ) : (
                  <div className="graph-drawer-region-checkboxes">
                    {regionsCatalog.map((r) => (
                      <label key={r.id} className="graph-drawer-checkbox-row">
                        <input
                          type="checkbox"
                          checked={formState.regionCodes.includes(r.code)}
                          onChange={() =>
                            setFormState((prev) => ({
                              ...prev,
                              regionCodes: toggleSortedCode(prev.regionCodes, r.code),
                            }))
                          }
                          disabled={isSaving || isDeleting}
                        />
                        <span>
                          {r.code}
                          {r.name ? ` — ${r.name}` : ''}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
              <label className="graph-drawer-field">
                <span className="graph-drawer-field-label">Year</span>
                <input
                  className="graph-drawer-input"
                  type="number"
                  inputMode="numeric"
                  min={1970}
                  max={2100}
                  placeholder="Ex: 2025"
                  value={formState.year}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, year: e.target.value }))
                  }
                  disabled={isSaving || isDeleting}
                />
              </label>
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
                  <p id="graph-delete-confirm-title" className="graph-details-delete-confirm-title">
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

        <section className="graph-details-section">
          <h3 className="graph-details-section-title">Contributors</h3>
          {details?.contributors && details.contributors.length > 0 ? (
            <>
              {details.contributors.map((c) => (
                <p key={c.id} className="graph-details-text">
                  {[c.firstName, c.lastName].filter(Boolean).join(' ').trim() || '—'}
                </p>
              ))}
            </>
          ) : (
            <p className="graph-details-text">No contributors linked to this application.</p>
          )}
        </section>
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
                state={moduleGraphMapState(
                  application.id,
                  details?.name ?? application.label
                )}
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
              disabled={
                suggestBusy || isDeleting || Boolean(details.hasModuleSubtree)
              }
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
              setFormErrorMessage(null);
              setSaveSuccessMessage(null);
              setShowDeleteConfirm(false);
              setDeleteErrorMessage(null);
              setFormState({
                name: details.name ?? '',
                description: details.description ?? '',
                year: details.year != null ? String(details.year) : '',
                businessUnitId: details.businessUnit?.id ?? '',
                regionCodes: regionCodesFromDetail(details),
              });
              setIsEditing(true);
            }}
          >
            <span className="graph-drawer-action-title">Edit</span>
          </button>
        )}
      </div>
    </aside>
  );
}

function regionCodesFromDetail(data: ApplicationResponse): string[] {
  if (!data.regions?.length) return [];
  return [...data.regions.map((r) => r.code).filter(Boolean)].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
}

function toggleSortedCode(codes: string[], code: string): string[] {
  const next = codes.includes(code) ? codes.filter((c) => c !== code) : [...codes, code];
  next.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  return next;
}

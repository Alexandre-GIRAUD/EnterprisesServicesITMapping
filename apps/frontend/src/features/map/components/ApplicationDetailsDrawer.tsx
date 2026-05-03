import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ApplicationRequest, ApplicationResponse } from '@/types/api';
import {
  deleteApplicationById,
  fetchApplicationById,
  suggestModulesFromGithub,
  updateApplicationById,
} from '../api/applicationsApi';
import { isGitHubLinkedApplication } from '../utils/githubLinkedApplication';

type ApplicationDetails = {
  id: string;
  label: string;
};

type ApplicationDetailsDrawerProps = {
  isOpen: boolean;
  application: ApplicationDetails | null;
  onClose: () => void;
  onOpenModuleGraph: (applicationId: string) => void;
  /** Invoked after backend delete succeeds; parent should remove the node from Cytoscape and close UI. */
  onApplicationDeleted: (applicationId: string) => void;
};

export function ApplicationDetailsDrawer({
  isOpen,
  application,
  onClose,
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
  const [formState, setFormState] = useState({
    name: '',
    description: '',
    validFrom: '',
    validTo: '',
  });

  useEffect(() => {
    if (!isOpen || !application?.id) return;
    let cancelled = false;
    setStatus('loading');
    setErrorMessage(null);
    setSaveSuccessMessage(null);
    setFormErrorMessage(null);
    setSuggestErrorMessage(null);
    setSuggestSuccessMessage(null);

    void fetchApplicationById(application.id)
      .then((data) => {
        if (cancelled) return;
        setDetails(data);
        setFormState({
          name: data.name ?? '',
          description: data.description ?? '',
          validFrom: isoToDateTimeLocal(data.validFrom),
          validTo: isoToDateTimeLocal(data.validTo),
        });
        setStatus('ready');
      })
      .catch((e) => {
        if (cancelled) return;
        setStatus('error');
        setErrorMessage(e instanceof Error ? e.message : "Impossible de charger les details");
      });

    return () => {
      cancelled = true;
    };
  }, [application?.id, isOpen]);

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
    }
  }, [isOpen]);

  const description =
    details?.description && details.description.trim().length > 0
      ? details.description
      : 'Description non renseignée.';

  const validFromText = useMemo(() => formatIsoDate(details?.validFrom), [details?.validFrom]);
  const validToText = useMemo(
    () => (details?.validTo ? formatIsoDate(details.validTo) : 'Toujours actif'),
    [details?.validTo]
  );

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!application?.id || !details) return;

    const name = formState.name.trim();
    if (!name) {
      setFormErrorMessage('Le champ name est obligatoire.');
      return;
    }

    const validFromDate = formState.validFrom ? new Date(formState.validFrom) : null;
    const validToDate = formState.validTo ? new Date(formState.validTo) : null;
    if (validFromDate && validToDate && validToDate.getTime() < validFromDate.getTime()) {
      setFormErrorMessage('Valid to doit être supérieur ou égal à validFrom.');
      return;
    }

    const payload: ApplicationRequest = {
      name,
      description: formState.description.trim() || '',
      validFrom: formState.validFrom ? new Date(formState.validFrom).toISOString() : undefined,
      validTo: formState.validTo ? new Date(formState.validTo).toISOString() : null,
    };

    try {
      setIsSaving(true);
      setFormErrorMessage(null);
      setSaveSuccessMessage(null);
      const updated = await updateApplicationById(application.id, payload);
      setDetails(updated);
      setFormState({
        name: updated.name ?? '',
        description: updated.description ?? '',
        validFrom: isoToDateTimeLocal(updated.validFrom),
        validTo: isoToDateTimeLocal(updated.validTo),
      });
      setSaveSuccessMessage('Application mise à jour.');
      setIsEditing(false);
    } catch (e) {
      setFormErrorMessage(
        e instanceof Error ? e.message : "Impossible d'enregistrer les modifications."
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
      validFrom: isoToDateTimeLocal(details.validFrom),
      validTo: isoToDateTimeLocal(details.validTo),
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
        `${res.created.length} module(s) créé(s). ${res.skipped.length} entrée(s) ignorée(s).`
      );
    } catch (e) {
      setSuggestErrorMessage(
        e instanceof Error ? e.message : 'Suggestion modules IA impossible.'
      );
    } finally {
      setSuggestBusy(false);
    }
  }

  async function onConfirmDelete() {
    const id = application?.id;
    if (!id) return;
    try {
      setIsDeleting(true);
      setDeleteErrorMessage(null);
      await deleteApplicationById(id);
      onApplicationDeleted(id);
      setShowDeleteConfirm(false);
    } catch (e) {
      setDeleteErrorMessage(
        e instanceof Error ? e.message : 'Impossible de supprimer cette application.'
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <aside
      className={`graph-details-drawer${isOpen ? ' is-open' : ''}`}
      aria-label="Panneau de détails d'application"
    >
      <header className="graph-details-header">
        <p className="graph-drawer-eyebrow">Application</p>
        <div className="graph-drawer-title-row">
          <div>
            <h2 className="graph-drawer-title">{application?.label ?? 'Détails'}</h2>
            {application?.id && <p className="graph-details-id">{application.id}</p>}
          </div>
          <button
            type="button"
            className="graph-drawer-close"
            onClick={onClose}
            aria-label="Fermer les détails application"
          >
            x
          </button>
        </div>
      </header>

      <div className="graph-details-content">
        {status === 'loading' && <p className="graph-details-text">Chargement...</p>}
        {status === 'error' && (
          <p className="graph-details-text graph-details-text-error">
            {errorMessage ?? 'Impossible de charger les détails.'}
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
                <h3 className="graph-details-section-title">Validité</h3>
                <p className="graph-details-text">
                  <strong>Valid from:</strong> {validFromText}
                </p>
                <p className="graph-details-text">
                  <strong>Valid to:</strong> {validToText}
                </p>
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
                <span className="graph-drawer-field-label">validFrom</span>
                <input
                  className="graph-drawer-input"
                  type="datetime-local"
                  value={formState.validFrom}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, validFrom: e.target.value }))
                  }
                  disabled={isSaving || isDeleting}
                />
              </label>
              <label className="graph-drawer-field">
                <span className="graph-drawer-field-label">validTo</span>
                <input
                  className="graph-drawer-input"
                  type="datetime-local"
                  value={formState.validTo}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, validTo: e.target.value }))
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
                    Neo4j
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
                    Supprimer cette application ? Les modules reliés via CONTAINS et les arêtes attachées
                    seront supprimés définitivement.
                  </p>
                  <div className="graph-details-delete-confirm-actions">
                    <button
                      type="button"
                      className="graph-drawer-action graph-drawer-action-danger-solid"
                      disabled={isDeleting}
                      onClick={() => void onConfirmDelete()}
                    >
                      <span className="graph-drawer-action-title">
                        {isDeleting ? 'Suppression…' : 'Confirmer la suppression'}
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
                      <span className="graph-drawer-action-title">Annuler</span>
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
          <p className="graph-details-text">Contributors: à venir</p>
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
                to={`/map/apps/${encodeURIComponent(application.id)}`}
              >
                Voir le graphe modules
              </Link>
            ) : null}
          </p>
        )}
        {application?.id &&
          status === 'ready' &&
          !isEditing &&
          details &&
          isGitHubLinkedApplication(details) && (
            <button
              type="button"
              className="graph-drawer-action"
              disabled={
                suggestBusy || isDeleting || Boolean(details.hasModuleSubtree)
              }
              title={
                details.hasModuleSubtree
                  ? 'Des modules sont déjà liés à cette application. La suggestion IA ne peut être relancée.'
                  : undefined
              }
              aria-busy={suggestBusy}
              onClick={() => void onSuggestModulesFromGithub()}
            >
              <span className="graph-drawer-action-title">
                {suggestBusy
                  ? 'Analyse IA…'
                  : details.hasModuleSubtree
                    ? 'Modules déjà en place'
                    : 'Suggérer les modules (IA)'}
              </span>
            </button>
          )}
        {application?.id && (
          <button
            type="button"
            className="graph-drawer-action graph-drawer-action-primary"
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
              setFormErrorMessage(null);
              setSaveSuccessMessage(null);
              setShowDeleteConfirm(false);
              setDeleteErrorMessage(null);
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

function formatIsoDate(value?: string | null): string {
  if (!value) return 'Non renseigné';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function isoToDateTimeLocal(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

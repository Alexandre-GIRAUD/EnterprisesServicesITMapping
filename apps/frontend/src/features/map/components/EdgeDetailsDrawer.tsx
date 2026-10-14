import { type FormEvent, useEffect, useMemo, useState } from 'react';
import type { DataModelFieldDto, HumanChangeReason } from '@/types/api';
import { getDataModelRequest } from '@/features/datamodel/api/dataModelApi';
import { patchGraphEdgeAttributes, deleteGraphEdge } from '../api/graphApi';
import type { SelectedEdgeDetails } from '../utils/selectedEdgeFromDto';
import { legendLabelForData } from './graphTheme';
import { CommentsSection } from '@/features/comments/components/CommentsSection';
import {
  AttributeChangeReasonFields,
  buildChangeMeta,
  validateChangeMeta,
} from './AttributeChangeReasonFields';
import { AttributeHistorySection } from './AttributeHistorySection';
import { CloseIcon } from './CloseIcon';
import { AttributeValueControl } from './AttributeValueControl';
import {
  dedupeAttributeValues,
  sameAttributeValues,
  storedAttributeList,
  storedAttributeText,
  type StoredAttribute,
} from '../utils/attributeValue';

type EdgeDetailsDrawerProps = {
  isOpen: boolean;
  edge: SelectedEdgeDetails | null;
  onClose: () => void;
  onOpenApplication?: (applicationId: string, label: string) => void;
  /** Invoked after a successful edge attribute patch so the parent can refresh the graph. */
  onEdgeAttributesUpdated?: (edgeId: string, properties: Record<string, StoredAttribute>) => void;
  /** Invoked after a successful edge delete so the parent can remove it from the graph. */
  onEdgeDeleted?: (edgeId: string) => void;
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

function attributeValues(
  fields: DataModelFieldDto[],
  attributes: Record<string, StoredAttribute> | undefined
): Record<string, StoredAttribute> {
  return Object.fromEntries(
    fields.map((field) => {
      const values = storedAttributeList(attributes?.[field.key]);
      return [field.key, field.multiple ? values : (values[0] ?? '')];
    })
  );
}

function attributePayload(
  fields: DataModelFieldDto[],
  form: Record<string, StoredAttribute>
): Record<string, StoredAttribute> {
  return Object.fromEntries(
    fields.map((field) => {
      if (field.multiple) {
        return [field.key, dedupeAttributeValues(storedAttributeList(form[field.key]))];
      }
      return [field.key, storedAttributeList(form[field.key])[0] ?? ''];
    })
  );
}

/**
 * Right-hand details panel for a graph edge (DEPENDS_ON / etc.).
 * Edge Data Model attributes are editable (with change reason); sandbox stays local-only.
 */
export function EdgeDetailsDrawer({
  isOpen,
  edge,
  onClose,
  onOpenApplication,
  onEdgeAttributesUpdated,
  onEdgeDeleted,
}: EdgeDetailsDrawerProps) {
  const [edgeFields, setEdgeFields] = useState<DataModelFieldDto[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [attributeForm, setAttributeForm] = useState<Record<string, StoredAttribute>>({});
  const [localProperties, setLocalProperties] = useState<Record<string, StoredAttribute>>({});
  const [changeReason, setChangeReason] = useState<HumanChangeReason | ''>('');
  const [changeReasonComment, setChangeReasonComment] = useState('');
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState<HumanChangeReason | ''>('');
  const [deleteReasonComment, setDeleteReasonComment] = useState('');

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

  useEffect(() => {
    if (!isOpen || !edge) return;
    setLocalProperties(edge.properties ?? {});
    setIsEditing(false);
    setIsSaving(false);
    setFormErrorMessage(null);
    setSaveSuccessMessage(null);
    setChangeReason('');
    setChangeReasonComment('');
    setShowDeleteConfirm(false);
    setIsDeleting(false);
    setDeleteErrorMessage(null);
    setDeleteReason('');
    setDeleteReasonComment('');
    setAttributeForm(attributeValues(edgeFields, edge.properties));
  }, [edge, edgeFields, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
      setIsSaving(false);
      setFormErrorMessage(null);
      setSaveSuccessMessage(null);
      setChangeReason('');
      setChangeReasonComment('');
      setShowDeleteConfirm(false);
      setIsDeleting(false);
      setDeleteErrorMessage(null);
      setDeleteReason('');
      setDeleteReasonComment('');
    }
  }, [isOpen]);

  const attributeRows = useMemo(() => {
    const stored = localProperties;
    const rows = edgeFields.map((field) => ({
      key: field.key,
      label: field.label || field.key,
      value: storedAttributeText(stored[field.key]),
    }));
    const known = new Set(edgeFields.map((f) => f.key));
    for (const [key, value] of Object.entries(stored)) {
      if (!known.has(key) && key !== 'data') {
        rows.push({ key, label: key, value: storedAttributeText(value) });
      }
    }
    return rows;
  }, [localProperties, edgeFields]);

  const title = edge ? titleForEdge(edge) : 'Connection';
  const sandbox = Boolean(edge?.sandbox);

  function attributesChanged(next: Record<string, StoredAttribute>): boolean {
    return edgeFields.some((field) => !sameAttributeValues(next[field.key], localProperties[field.key]));
  }

  function startEditing() {
    if (!edge) return;
    setAttributeForm(attributeValues(edgeFields, localProperties));
    setChangeReason('');
    setChangeReasonComment('');
    setFormErrorMessage(null);
    setSaveSuccessMessage(null);
    setShowDeleteConfirm(false);
    setDeleteErrorMessage(null);
    setIsEditing(true);
  }

  function onCancelEdit() {
    setAttributeForm(attributeValues(edgeFields, localProperties));
    setChangeReason('');
    setChangeReasonComment('');
    setFormErrorMessage(null);
    setIsEditing(false);
  }

  async function onConfirmDelete() {
    if (!edge) return;

    if (sandbox) {
      try {
        setIsDeleting(true);
        setDeleteErrorMessage(null);
        onEdgeDeleted?.(edge.id);
        onClose();
      } finally {
        setIsDeleting(false);
      }
      return;
    }

    const reasonError = validateChangeMeta(deleteReason, deleteReasonComment);
    if (reasonError) {
      setDeleteErrorMessage(reasonError);
      return;
    }

    try {
      setIsDeleting(true);
      setDeleteErrorMessage(null);
      const changeMeta = buildChangeMeta(deleteReason, deleteReasonComment);
      await deleteGraphEdge(edge.id, changeMeta);
      onEdgeDeleted?.(edge.id);
      onClose();
    } catch (e) {
      setDeleteErrorMessage(e instanceof Error ? e.message : 'Unable to delete connection.');
    } finally {
      setIsDeleting(false);
    }
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!edge) return;

    const missing = edgeFields.find(
      (field) => field.required && storedAttributeList(attributeForm[field.key]).length === 0
    );
    if (missing) {
      setFormErrorMessage(`${missing.label || missing.key} is required.`);
      return;
    }

    const attributes = attributePayload(edgeFields, attributeForm);
    const dirty = attributesChanged(attributes);
    if (!dirty) {
      setIsEditing(false);
      return;
    }

    if (sandbox) {
      const nextProps = Object.fromEntries(
        Object.entries(attributes).filter(([, value]) => storedAttributeList(value).length > 0)
      );
      setLocalProperties(nextProps);
      onEdgeAttributesUpdated?.(edge.id, nextProps);
      setSaveSuccessMessage('Connection updated (sandbox, not saved).');
      setIsEditing(false);
      return;
    }

    const reasonError = validateChangeMeta(changeReason, changeReasonComment);
    if (reasonError) {
      setFormErrorMessage(reasonError);
      return;
    }

    try {
      setIsSaving(true);
      setFormErrorMessage(null);
      setSaveSuccessMessage(null);
      const changeMeta = buildChangeMeta(changeReason, changeReasonComment);
      const updated = await patchGraphEdgeAttributes(edge.id, attributes, changeMeta);
      setLocalProperties(updated);
      onEdgeAttributesUpdated?.(edge.id, updated);
      setHistoryRefreshKey((k) => k + 1);
      setSaveSuccessMessage('Connection attributes updated.');
      setIsEditing(false);
      setChangeReason('');
      setChangeReasonComment('');
    } catch (e) {
      setFormErrorMessage(e instanceof Error ? e.message : 'Unable to save changes.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <aside
      className={`graph-details-drawer graph-details-drawer--edge${isOpen ? ' is-open' : ''}`}
      aria-hidden={!isOpen}
      aria-label="Connection details panel"
    >
      <header className="graph-details-header">
        <p className="graph-drawer-eyebrow">
          {sandbox ? 'Connection (sandbox)' : 'Connection'}
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
            <CloseIcon />
          </button>
        </div>
      </header>

      <div className="graph-details-content">
        {!edge ? (
          <p className="graph-details-text">No connection selected.</p>
        ) : (
          <>
            {saveSuccessMessage && !isEditing ? (
              <p className="graph-drawer-feedback graph-drawer-feedback-success" role="status">
                {saveSuccessMessage}
              </p>
            ) : null}

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

            {!isEditing ? (
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
            ) : (
              <form className="graph-drawer-form" onSubmit={(e) => void onSave(e)}>
                {edgeFields.length > 0 ? (
                  <fieldset className="graph-drawer-field graph-drawer-fieldset">
                    <legend className="graph-drawer-field-label">Edge attributes</legend>
                    {edgeFields.map((field) => (
                      <AttributeValueControl
                        key={field.key}
                        field={field}
                        value={attributeForm[field.key] ?? (field.multiple ? [] : '')}
                        disabled={isSaving}
                        onChange={(next) =>
                          setAttributeForm((prev) => ({ ...prev, [field.key]: next }))
                        }
                      />
                    ))}
                    <p className="graph-drawer-field-hint">
                      Defined in the Data Model. Leave empty to clear the value.
                    </p>
                  </fieldset>
                ) : (
                  <p className="graph-details-text">
                    No edge attribute configured in the Data Model. Add Connection (edge) fields
                    to edit values here.
                  </p>
                )}

                {!sandbox && edgeFields.length > 0 ? (
                  <AttributeChangeReasonFields
                    reason={changeReason}
                    reasonComment={changeReasonComment}
                    onReasonChange={setChangeReason}
                    onCommentChange={setChangeReasonComment}
                    disabled={isSaving}
                    required
                  />
                ) : null}

                {formErrorMessage ? (
                  <p className="graph-drawer-feedback graph-drawer-feedback-error" role="alert">
                    {formErrorMessage}
                  </p>
                ) : null}

                <div className="graph-drawer-form-actions">
                  {edgeFields.length > 0 ? (
                    <button
                      type="submit"
                      className="graph-drawer-action graph-drawer-action-primary"
                      disabled={isSaving}
                    >
                      <span className="graph-drawer-action-title">
                        {isSaving ? 'Saving…' : 'Save'}
                      </span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="graph-drawer-action"
                    onClick={onCancelEdit}
                    disabled={isSaving}
                  >
                    <span className="graph-drawer-action-title">Cancel</span>
                  </button>
                </div>
              </form>
            )}

            <AttributeHistorySection
              targetType="EDGE"
              targetId={edge.id}
              enabled={!sandbox}
              refreshKey={historyRefreshKey}
            />

            <CommentsSection targetType="EDGE" targetId={edge.id} enabled={!sandbox} />
          </>
        )}
      </div>

      {edge ? (
        <div className="graph-details-actions">
          {!isEditing ? (
            <button
              type="button"
              className="graph-drawer-action"
              onClick={startEditing}
              disabled={isDeleting}
            >
              <span className="graph-drawer-action-title">Edit</span>
            </button>
          ) : null}
          {!showDeleteConfirm ? (
            <button
              type="button"
              className="graph-drawer-action graph-drawer-action-danger"
              disabled={isDeleting || isSaving}
              onClick={() => {
                setDeleteErrorMessage(null);
                setDeleteReason('');
                setDeleteReasonComment('');
                setShowDeleteConfirm(true);
              }}
            >
              <span className="graph-drawer-action-title">Delete</span>
              {sandbox ? (
                <span className="graph-drawer-action-meta" aria-hidden="true">
                  Local
                </span>
              ) : null}
            </button>
          ) : (
            <div
              className="graph-details-delete-confirm"
              role="dialog"
              aria-modal="true"
              aria-labelledby="graph-edge-delete-confirm-title"
            >
              <p
                id="graph-edge-delete-confirm-title"
                className="graph-details-delete-confirm-title"
              >
                {sandbox
                  ? 'Remove this connection from the sandbox graph? No database data will be changed.'
                  : 'Delete this connection permanently from Neo4j?'}
              </p>
              {!sandbox ? (
                <AttributeChangeReasonFields
                  reason={deleteReason}
                  reasonComment={deleteReasonComment}
                  onReasonChange={setDeleteReason}
                  onCommentChange={setDeleteReasonComment}
                  disabled={isDeleting}
                  required
                />
              ) : null}
              {deleteErrorMessage ? (
                <p className="graph-drawer-feedback graph-drawer-feedback-error" role="alert">
                  {deleteErrorMessage}
                </p>
              ) : null}
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
                    setDeleteReason('');
                    setDeleteReasonComment('');
                  }}
                >
                  <span className="graph-drawer-action-title">Cancel</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </aside>
  );
}

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { HumanChangeReason } from '@/types/api';
import { patchModuleDetails } from '../api/graphApi';
import {
  changedModuleFields,
  parseDataList,
  type ModuleDetails,
} from '../utils/moduleDetails';
import {
  AttributeChangeReasonFields,
  buildChangeMeta,
  validateChangeMeta,
} from './AttributeChangeReasonFields';
import { AttributeHistorySection } from './AttributeHistorySection';
import { CloseIcon } from './CloseIcon';
import { moduleTone } from './graphTheme';

type Props = {
  isOpen: boolean;
  applicationId: string;
  applicationName: string;
  /** Modules in layout order; the tone slot of each one comes from the module graph. */
  modules: Array<ModuleDetails & { colorSlot: number | null }>;
  selectedId: string | null;
  onSelect: (moduleId: string | null) => void;
  onClose: () => void;
  /** The module graph was edited: reload it. */
  onSaved: () => void;
  /** Past day shown: read only. */
  isReadOnly?: boolean;
};

type Form = {
  description: string;
  owner: string;
  technology: string;
  dataIn: string;
  dataOut: string;
};

function formOf(module: ModuleDetails): Form {
  return {
    description: module.description,
    owner: module.owner,
    technology: module.technology,
    dataIn: module.dataIn.join('\n'),
    dataOut: module.dataOut.join('\n'),
  };
}

function unionOf(lists: string[][]): string[] {
  return parseDataList(lists.flat().join('\n'));
}

function Chips({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="graph-details-text">No data declared.</p>;
  return (
    <ul className="module-drawer-chips">
      {items.map((item) => (
        <li key={item} className="module-drawer-chip">
          {item}
        </li>
      ))}
    </ul>
  );
}

/**
 * One drawer for the whole application while its module view is shown: the data its modules
 * consume and produce, then one card per module (description, owner, technology, data in / out).
 * A module is edited in place with a change reason, and every change lands in the history.
 */
export function ApplicationModulesDrawer({
  isOpen,
  applicationId,
  applicationName,
  modules,
  selectedId,
  onSelect,
  onClose,
  onSaved,
  isReadOnly = false,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [reason, setReason] = useState<HumanChangeReason | ''>('');
  const [reasonComment, setReasonComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const selectedRef = useRef<HTMLLIElement>(null);

  const dataIn = useMemo(() => unionOf(modules.map((m) => m.dataIn)), [modules]);
  const dataOut = useMemo(() => unionOf(modules.map((m) => m.dataOut)), [modules]);

  useEffect(() => {
    selectedRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  useEffect(() => {
    setEditingId(null);
    setForm(null);
    setSuccessMessage(null);
  }, [applicationId]);

  function startEditing(module: ModuleDetails) {
    setEditingId(module.id);
    setForm(formOf(module));
    setReason('');
    setReasonComment('');
    setErrorMessage(null);
    setSuccessMessage(null);
    onSelect(module.id);
  }

  function stopEditing() {
    setEditingId(null);
    setForm(null);
    setErrorMessage(null);
  }

  async function onSave(event: FormEvent<HTMLFormElement>, module: ModuleDetails) {
    event.preventDefault();
    if (!form) return;
    const next: ModuleDetails = {
      ...module,
      description: form.description.trim(),
      owner: form.owner.trim(),
      technology: form.technology.trim(),
      dataIn: parseDataList(form.dataIn),
      dataOut: parseDataList(form.dataOut),
    };
    const changed = changedModuleFields(module, next);
    if (changed.length === 0) {
      stopEditing();
      return;
    }
    const reasonError = validateChangeMeta(reason, reasonComment);
    const changeMeta = buildChangeMeta(reason, reasonComment);
    if (reasonError || !changeMeta) {
      setErrorMessage(reasonError ?? 'A change reason is required.');
      return;
    }
    try {
      setIsSaving(true);
      setErrorMessage(null);
      await patchModuleDetails(
        applicationId,
        module.id,
        {
          description: next.description,
          owner: next.owner,
          technology: next.technology,
          dataIn: next.dataIn,
          dataOut: next.dataOut,
        },
        changeMeta
      );
      setHistoryRefreshKey((k) => k + 1);
      setSuccessMessage(`${module.name} updated.`);
      stopEditing();
      onSaved();
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Unable to save the module.');
    } finally {
      setIsSaving(false);
    }
  }

  function setField(key: keyof Form, value: string) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function renderEditForm(module: ModuleDetails) {
    if (!form) return null;
    return (
      <form className="graph-drawer-form" onSubmit={(e) => void onSave(e, module)}>
        <label className="graph-drawer-field">
          <span className="graph-drawer-field-label">Description</span>
          <textarea
            className="graph-drawer-input graph-drawer-textarea"
            value={form.description}
            rows={3}
            onChange={(e) => setField('description', e.target.value)}
            disabled={isSaving}
          />
        </label>
        <label className="graph-drawer-field">
          <span className="graph-drawer-field-label">Owner</span>
          <input
            className="graph-drawer-input"
            value={form.owner}
            onChange={(e) => setField('owner', e.target.value)}
            disabled={isSaving}
          />
        </label>
        <label className="graph-drawer-field">
          <span className="graph-drawer-field-label">Technology</span>
          <input
            className="graph-drawer-input"
            value={form.technology}
            onChange={(e) => setField('technology', e.target.value)}
            disabled={isSaving}
          />
        </label>
        <label className="graph-drawer-field">
          <span className="graph-drawer-field-label">Data consumed (in)</span>
          <textarea
            className="graph-drawer-input graph-drawer-textarea"
            value={form.dataIn}
            rows={3}
            onChange={(e) => setField('dataIn', e.target.value)}
            disabled={isSaving}
          />
          <span className="graph-drawer-field-hint">One per line or comma separated.</span>
        </label>
        <label className="graph-drawer-field">
          <span className="graph-drawer-field-label">Data produced (out)</span>
          <textarea
            className="graph-drawer-input graph-drawer-textarea"
            value={form.dataOut}
            rows={3}
            onChange={(e) => setField('dataOut', e.target.value)}
            disabled={isSaving}
          />
          <span className="graph-drawer-field-hint">
            A module that consumes what another produces shares its color.
          </span>
        </label>
        <AttributeChangeReasonFields
          reason={reason}
          reasonComment={reasonComment}
          onReasonChange={setReason}
          onCommentChange={setReasonComment}
          disabled={isSaving}
        />
        {errorMessage && (
          <p className="graph-drawer-feedback graph-drawer-feedback-error" role="alert">
            {errorMessage}
          </p>
        )}
        <div className="graph-drawer-form-actions">
          <button
            type="submit"
            className="graph-drawer-action graph-drawer-action-primary"
            disabled={isSaving}
          >
            <span className="graph-drawer-action-title">{isSaving ? 'Saving…' : 'Save'}</span>
          </button>
          <button
            type="button"
            className="graph-drawer-action"
            onClick={stopEditing}
            disabled={isSaving}
          >
            <span className="graph-drawer-action-title">Cancel</span>
          </button>
        </div>
      </form>
    );
  }

  function renderModule(module: ModuleDetails & { colorSlot: number | null }) {
    const isEditing = editingId === module.id;
    const isSelected = selectedId === module.id;
    return (
      <li
        key={module.id}
        ref={isSelected ? selectedRef : undefined}
        className={`module-drawer-card${isSelected ? ' is-selected' : ''}`}
      >
        <div className="module-drawer-card__head">
          <span
            className="module-drawer-card__dot"
            style={{ backgroundColor: moduleTone(module.colorSlot).border }}
            aria-hidden="true"
          />
          <button
            type="button"
            className="module-drawer-card__name"
            onClick={() => onSelect(isSelected ? null : module.id)}
          >
            {module.name}
          </button>
          {!isReadOnly && !isEditing && (
            <button
              type="button"
              className="graph-drawer-action module-drawer-card__edit"
              onClick={() => startEditing(module)}
            >
              <span className="graph-drawer-action-title">Edit</span>
            </button>
          )}
        </div>
        {isEditing ? (
          renderEditForm(module)
        ) : (
          <dl className="graph-details-attribute-list">
            <div className="graph-details-attribute-row">
              <dt className="graph-details-attribute-label">Description</dt>
              <dd className="graph-details-text">{module.description || 'No description provided.'}</dd>
            </div>
            <div className="graph-details-attribute-row">
              <dt className="graph-details-attribute-label">Owner</dt>
              <dd className="graph-details-text">{module.owner || 'Not set'}</dd>
            </div>
            <div className="graph-details-attribute-row">
              <dt className="graph-details-attribute-label">Technology</dt>
              <dd className="graph-details-text">{module.technology || 'Not set'}</dd>
            </div>
            <div className="graph-details-attribute-row">
              <dt className="graph-details-attribute-label">Data in</dt>
              <dd>
                <Chips items={module.dataIn} />
              </dd>
            </div>
            <div className="graph-details-attribute-row">
              <dt className="graph-details-attribute-label">Data out</dt>
              <dd>
                <Chips items={module.dataOut} />
              </dd>
            </div>
          </dl>
        )}
      </li>
    );
  }

  return (
    <aside
      className={`graph-details-drawer module-drawer${isOpen ? ' is-open' : ''}`}
      aria-label="Application modules panel"
    >
      <header className="graph-details-header">
        <p className="graph-drawer-eyebrow">Application modules</p>
        <div className="graph-drawer-title-row">
          <div className="graph-details-header-main">
            <h2 className="graph-drawer-title" title={applicationName}>
              {applicationName}
            </h2>
            <p className="graph-details-id">{modules.length} modules</p>
          </div>
          <div className="graph-drawer-header-actions">
            <button
              type="button"
              className="graph-drawer-close"
              onClick={onClose}
              aria-label="Close modules panel"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      </header>

      <div className="graph-details-content">
        {successMessage && (
          <p className="graph-drawer-feedback graph-drawer-feedback-success" role="status">
            {successMessage}
          </p>
        )}
        <section className="graph-details-section">
          <h3 className="graph-details-section-title">Data consumed by the application</h3>
          <p className="graph-drawer-field-label">In</p>
          <Chips items={dataIn} />
          <p className="graph-drawer-field-label">Out</p>
          <Chips items={dataOut} />
        </section>

        <section className="graph-details-section">
          <h3 className="graph-details-section-title">Modules</h3>
          {modules.length === 0 ? (
            <p className="graph-details-text">No modules linked to this application yet.</p>
          ) : (
            <ul className="module-drawer-list">{modules.map(renderModule)}</ul>
          )}
        </section>

        <AttributeHistorySection
          targetType="APPLICATION"
          targetId={applicationId}
          enabled
          refreshKey={historyRefreshKey}
        />
      </div>
    </aside>
  );
}

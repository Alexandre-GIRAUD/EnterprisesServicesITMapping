import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { HumanChangeReason } from '@/types/api';
import { patchModuleDetails } from '../api/graphApi';
import { changedModuleFields, parseDataList, type ModuleDetails } from '../utils/moduleDetails';
import { buildChangeMeta, validateChangeMeta } from './AttributeChangeReasonFields';
import { AttributeHistorySection } from './AttributeHistorySection';
import { CloseIcon } from './CloseIcon';
import { DataChips, ModuleCard } from './ModuleCard';
import { ModuleEditForm, type ModuleForm } from './ModuleEditForm';

type DrawerModule = ModuleDetails & { colorSlot: number | null };

type Props = {
  isOpen: boolean;
  applicationId: string;
  applicationName: string;
  applicationDescription: string;
  /** Modules in layout order; the tone slot of each one comes from the module graph. */
  modules: DrawerModule[];
  selectedId: string | null;
  onSelect: (moduleId: string | null) => void;
  onClose: () => void;
  /** The module graph was edited: reload it. */
  onSaved: () => void;
  /** Past day shown: read only. */
  isReadOnly?: boolean;
};

function formOf(module: ModuleDetails): ModuleForm {
  return {
    description: module.description,
    owner: module.owner,
    technology: module.technology,
    dataIn: module.dataIn.join('\n'),
    dataOut: module.dataOut.join('\n'),
  };
}

function editedModule(module: ModuleDetails, form: ModuleForm): ModuleDetails {
  return {
    ...module,
    description: form.description.trim(),
    owner: form.owner.trim(),
    technology: form.technology.trim(),
    dataIn: parseDataList(form.dataIn),
    dataOut: parseDataList(form.dataOut),
  };
}

function unionOf(lists: string[][]): string[] {
  return parseDataList(lists.flat().join('\n'));
}

/**
 * One drawer for the whole application while its module view is shown: its description, the data
 * its modules consume and produce, then one card per module. A module is edited in place with a
 * change reason, and every change lands in the application history.
 */
export function ApplicationModulesDrawer({
  isOpen,
  applicationId,
  applicationName,
  applicationDescription,
  modules,
  selectedId,
  onSelect,
  onClose,
  onSaved,
  isReadOnly = false,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ModuleForm | null>(null);
  const [reason, setReason] = useState<HumanChangeReason | ''>('');
  const [reasonComment, setReasonComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const selectedRef = useRef<HTMLLIElement>(null);

  const dataIn = useMemo(() => unionOf(modules.map((module) => module.dataIn)), [modules]);
  const moduleNames = useMemo(
    () => new Map(modules.map((module) => [module.id, module.name])),
    [modules]
  );
  const dataOut = useMemo(() => unionOf(modules.map((module) => module.dataOut)), [modules]);

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

  async function saveModule(module: ModuleDetails, edited: ModuleDetails) {
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
          description: edited.description,
          owner: edited.owner,
          technology: edited.technology,
          dataIn: edited.dataIn,
          dataOut: edited.dataOut,
        },
        changeMeta
      );
      setHistoryRefreshKey((key) => key + 1);
      setSuccessMessage(`${module.name} updated.`);
      stopEditing();
      onSaved();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save the module.');
    } finally {
      setIsSaving(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>, module: ModuleDetails) {
    event.preventDefault();
    if (!form) return;
    const edited = editedModule(module, form);
    if (changedModuleFields(module, edited).length === 0) {
      stopEditing();
      return;
    }
    void saveModule(module, edited);
  }

  function renderEditor(module: ModuleDetails) {
    if (!form) return null;
    return (
      <ModuleEditForm
        form={form}
        onFieldChange={(key, value) => setForm((prev) => (prev ? { ...prev, [key]: value } : prev))}
        reason={reason}
        reasonComment={reasonComment}
        onReasonChange={setReason}
        onCommentChange={setReasonComment}
        isSaving={isSaving}
        errorMessage={errorMessage}
        onSubmit={(event) => onSubmit(event, module)}
        onCancel={stopEditing}
      />
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
          <h3 className="graph-details-section-title">Description</h3>
          <p className="graph-details-text">
            {applicationDescription || 'No description provided.'}
          </p>
        </section>

        <section className="graph-details-section">
          <h3 className="graph-details-section-title">Data consumed by the application</h3>
          <p className="graph-drawer-field-label">In</p>
          <DataChips items={dataIn} />
          <p className="graph-drawer-field-label">Out</p>
          <DataChips items={dataOut} />
        </section>

        <section className="graph-details-section">
          <h3 className="graph-details-section-title">Modules</h3>
          {modules.length === 0 ? (
            <p className="graph-details-text">No modules linked to this application yet.</p>
          ) : (
            <ul className="module-drawer-list">
              {modules.map((module) => (
                <ModuleCard
                  key={module.id}
                  ref={selectedId === module.id ? selectedRef : undefined}
                  module={module}
                  isSelected={selectedId === module.id}
                  isEditing={editingId === module.id}
                  canEdit={!isReadOnly}
                  onToggleSelect={() => onSelect(selectedId === module.id ? null : module.id)}
                  onEdit={() => startEditing(module)}
                  editor={renderEditor(module)}
                />
              ))}
            </ul>
          )}
        </section>

        <AttributeHistorySection
          targetType="APPLICATION"
          targetId={applicationId}
          enabled
          refreshKey={historyRefreshKey}
          moduleNames={moduleNames}
        />
      </div>
    </aside>
  );
}

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { HumanChangeReason } from '@/types/api';
import { patchModuleDetails } from '../api/graphApi';
import {
  changedModuleFields,
  externalData,
  parseDataList,
  type ApplicationModel,
  type ModuleDetails,
  type ModuleLink,
} from '../utils/moduleDetails';
import { ApplicationModelPanel } from './ApplicationModelPanel';
import { buildChangeMeta, validateChangeMeta } from './AttributeChangeReasonFields';
import { AttributeHistorySection } from './AttributeHistorySection';
import { CloseIcon } from './CloseIcon';
import { ModuleCard } from './ModuleCard';
import { ModuleEditForm, type ModuleForm } from './ModuleEditForm';
import { dragDrawerWidth } from './drawerWidth';
import { scopedModule } from './moduleDrawerScope';

type DrawerModule = ModuleDetails & { colorSlot: number | null };

type Props = {
  isOpen: boolean;
  applicationId: string;
  applicationName: string;
  applicationDescription: string;
  applicationModel: ApplicationModel;
  /** Explicit links between the modules. */
  links: ModuleLink[];
  /** Modules in layout order; the tone slot of each one comes from the module graph. */
  modules: DrawerModule[];
  selectedId: string | null;
  onSelect: (moduleId: string | null) => void;
  onClose: () => void;
  /** Drawer width in px; dragging its left edge changes it. */
  width: number;
  onWidthChange: (width: number) => void;
  /** The module graph was edited: reload it. */
  onSaved: () => void;
  /** Past day shown: read only. */
  isReadOnly?: boolean;
};

function formOf(module: ModuleDetails): ModuleForm {
  return {
    description: module.description,
    owner: module.owner,
    actors: module.actors.join('\n'),
    trigger: module.trigger,
    dataIn: module.dataIn,
    dataOut: module.dataOut,
  };
}

function editedModule(module: ModuleDetails, form: ModuleForm): ModuleDetails {
  return {
    ...module,
    description: form.description.trim(),
    owner: form.owner.trim(),
    actors: parseDataList(form.actors),
    trigger: form.trigger.trim(),
    dataIn: form.dataIn,
    dataOut: form.dataOut,
  };
}

/**
 * One drawer for the module view. With a module selected it shows that module only; with the
 * application selected (or nothing) it shows the application description, its business model
 * (journey, scope, lexicon, links between modules), then one card per functional module.
 * Everything is edited in place with a change reason and lands in the application history.
 */
export function ApplicationModulesDrawer({
  isOpen,
  applicationId,
  applicationName,
  applicationDescription,
  applicationModel,
  links,
  modules,
  selectedId,
  onSelect,
  onClose,
  width,
  onWidthChange,
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
  const drawerRef = useRef<HTMLElement>(null);
  const focusModule = scopedModule(modules, selectedId);

  const external = useMemo(() => externalData(modules), [modules]);
  const moduleNames = useMemo(
    () => new Map(modules.map((module) => [module.id, module.name])),
    [modules]
  );

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

  function refreshAfterSave(message: string) {
    setHistoryRefreshKey((key) => key + 1);
    setSuccessMessage(message);
    onSaved();
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
          actors: edited.actors,
          trigger: edited.trigger,
          dataIn: edited.dataIn,
          dataOut: edited.dataOut,
        },
        changeMeta
      );
      stopEditing();
      refreshAfterSave(`${module.name} updated.`);
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

  function startResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const paneWidth = drawerRef.current?.parentElement?.clientWidth ?? window.innerWidth;
    const drag = { startWidth: width, startX: event.clientX, paneWidth };
    const onMove = (moveEvent: PointerEvent) =>
      onWidthChange(dragDrawerWidth({ ...drag, x: moveEvent.clientX }));
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function renderCard(module: DrawerModule) {
    return (
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
    );
  }

  function renderEditor(module: ModuleDetails) {
    if (!form) return null;
    return (
      <ModuleEditForm
        form={form}
        businessObjects={applicationModel.businessObjects}
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
      ref={drawerRef}
      className={`graph-details-drawer module-drawer${isOpen ? ' is-open' : ''}`}
      style={{ width }}
      aria-label="Application modules panel"
    >
      <div
        className="module-drawer__grip"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize modules panel"
        title="Drag to resize"
        onPointerDown={startResize}
      />
      <header className="graph-details-header">
        <p className="graph-drawer-eyebrow">{focusModule ? 'Module' : 'Application modules'}</p>
        <div className="graph-drawer-title-row">
          <div className="graph-details-header-main">
            <h2 className="graph-drawer-title" title={focusModule?.name ?? applicationName}>
              {focusModule?.name ?? applicationName}
            </h2>
            <p className="graph-details-id">
              {focusModule ? applicationName : `${modules.length} modules`}
            </p>
          </div>
          <div className="graph-drawer-header-actions">
            {focusModule && (
              <button
                type="button"
                className="graph-drawer-action module-drawer__all"
                onClick={() => onSelect(null)}
              >
                <span className="graph-drawer-action-title">All modules</span>
              </button>
            )}
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
        {focusModule ? (
          <ul className="module-drawer-list">{renderCard(focusModule)}</ul>
        ) : (
          <>
            <section className="graph-details-section">
              <h3 className="graph-details-section-title">Description</h3>
              <p className="graph-details-text">
                {applicationDescription || 'No description provided.'}
              </p>
            </section>

            <ApplicationModelPanel
              applicationId={applicationId}
              model={applicationModel}
              links={links}
              modules={modules}
              externalInputs={external.inputs}
              externalOutputs={external.outputs}
              isReadOnly={isReadOnly}
              onSaved={() => refreshAfterSave('Application model updated.')}
            />

            <section className="graph-details-section">
              <h3 className="graph-details-section-title">Modules</h3>
              {modules.length === 0 ? (
                <p className="graph-details-text">No modules linked to this application yet.</p>
              ) : (
                <ul className="module-drawer-list">{modules.map(renderCard)}</ul>
              )}
            </section>
          </>
        )}

        <AttributeHistorySection
          targetType="APPLICATION"
          targetId={applicationId}
          enabled
          refreshKey={historyRefreshKey}
          moduleNames={moduleNames}
          onlyModuleId={focusModule?.id}
        />
      </div>
    </aside>
  );
}

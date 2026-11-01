import { useState, type FormEvent } from 'react';
import type { HumanChangeReason } from '@/types/api';
import { patchBusinessModel } from '../api/graphApi';
import {
  parseDataList,
  type ApplicationModel,
  type ModuleLink,
} from '../utils/moduleDetails';
import {
  AttributeChangeReasonFields,
  buildChangeMeta,
  validateChangeMeta,
} from './AttributeChangeReasonFields';
import { DataChips } from './ModuleCard';
import { ModuleLinksEditor } from './ModuleLinksEditor';

type ModuleOption = { id: string; name: string };

type Props = {
  applicationId: string;
  model: ApplicationModel;
  links: ModuleLink[];
  modules: ModuleOption[];
  /** What crosses the application border, derived from the modules. */
  externalInputs: string[];
  externalOutputs: string[];
  isReadOnly: boolean;
  onSaved: () => void;
};

type Form = { mainJourney: string; scope: string; businessObjects: string; links: ModuleLink[] };

const NO_TEXT = 'Not described yet.';
const NO_LINK_TEXT = 'No link between modules yet.';
const TEXT_AREA_ROWS = 3;

function formOf(model: ApplicationModel, links: ModuleLink[]): Form {
  return {
    mainJourney: model.mainJourney,
    scope: model.scope,
    businessObjects: model.businessObjects.join('\n'),
    links,
  };
}

function linkLabel(link: ModuleLink, modules: ModuleOption[]): string {
  const nameOf = (id: string) => modules.find((module) => module.id === id)?.name ?? id;
  return `${nameOf(link.sourceId)} → ${nameOf(link.targetId)}${link.object ? ` (${link.object})` : ''}`;
}

/**
 * The application level of the module drawer: main journey, scope, the lexicon of business
 * objects, the explicit links between modules, and what crosses the application border.
 */
export function ApplicationModelPanel({
  applicationId,
  model,
  links,
  modules,
  externalInputs,
  externalOutputs,
  isReadOnly,
  onSaved,
}: Props) {
  const [form, setForm] = useState<Form | null>(null);
  const [reason, setReason] = useState<HumanChangeReason | ''>('');
  const [reasonComment, setReasonComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const lexicon = form ? parseDataList(form.businessObjects) : model.businessObjects;

  function startEditing() {
    setForm(formOf(model, links));
    setReason('');
    setReasonComment('');
    setErrorMessage(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    const reasonError = validateChangeMeta(reason, reasonComment);
    const changeMeta = buildChangeMeta(reason, reasonComment);
    if (reasonError || !changeMeta) {
      setErrorMessage(reasonError ?? 'A change reason is required.');
      return;
    }
    try {
      setIsSaving(true);
      setErrorMessage(null);
      await patchBusinessModel(
        applicationId,
        {
          businessObjects: parseDataList(form.businessObjects),
          moduleLinks: form.links,
          mainJourney: form.mainJourney.trim(),
          scope: form.scope.trim(),
        },
        changeMeta
      );
      setForm(null);
      onSaved();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save the application model.');
    } finally {
      setIsSaving(false);
    }
  }

  if (form) {
    return (
      <form className="graph-drawer-form" onSubmit={(event) => void onSubmit(event)}>
        <label className="graph-drawer-field">
          <span className="graph-drawer-field-label">Main journey</span>
          <textarea
            className="graph-drawer-input graph-drawer-textarea"
            rows={TEXT_AREA_ROWS}
            value={form.mainJourney}
            disabled={isSaving}
            onChange={(event) => setForm({ ...form, mainJourney: event.target.value })}
          />
          <span className="graph-drawer-field-hint">How the modules chain, from start to end.</span>
        </label>
        <label className="graph-drawer-field">
          <span className="graph-drawer-field-label">Scope</span>
          <textarea
            className="graph-drawer-input graph-drawer-textarea"
            rows={TEXT_AREA_ROWS}
            value={form.scope}
            disabled={isSaving}
            onChange={(event) => setForm({ ...form, scope: event.target.value })}
          />
          <span className="graph-drawer-field-hint">What the application covers and what it does not.</span>
        </label>
        <label className="graph-drawer-field">
          <span className="graph-drawer-field-label">Business objects</span>
          <textarea
            className="graph-drawer-input graph-drawer-textarea"
            rows={TEXT_AREA_ROWS}
            value={form.businessObjects}
            disabled={isSaving}
            onChange={(event) => setForm({ ...form, businessObjects: event.target.value })}
          />
          <span className="graph-drawer-field-hint">
            The shared vocabulary, one per line. Modules pick their data from it.
          </span>
        </label>
        <ModuleLinksEditor
          links={form.links}
          modules={modules}
          businessObjects={lexicon}
          disabled={isSaving}
          onChange={(next) => setForm({ ...form, links: next })}
        />
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
            disabled={isSaving}
            onClick={() => setForm(null)}
          >
            <span className="graph-drawer-action-title">Cancel</span>
          </button>
        </div>
      </form>
    );
  }

  return (
    <>
      <section className="graph-details-section">
        <h3 className="graph-details-section-title">Main journey</h3>
        <p className="graph-details-text">{model.mainJourney || NO_TEXT}</p>
      </section>
      <section className="graph-details-section">
        <h3 className="graph-details-section-title">Scope</h3>
        <p className="graph-details-text">{model.scope || NO_TEXT}</p>
      </section>
      <section className="graph-details-section">
        <h3 className="graph-details-section-title">Business objects</h3>
        {model.businessObjects.length === 0 ? (
          <p className="graph-details-text">No business object yet.</p>
        ) : (
          <DataChips items={model.businessObjects} />
        )}
      </section>
      <section className="graph-details-section">
        <h3 className="graph-details-section-title">Links between modules</h3>
        {links.length === 0 ? (
          <p className="graph-details-text">{NO_LINK_TEXT}</p>
        ) : (
          <ul className="module-drawer-links">
            {links.map((link) => (
              <li key={`${link.sourceId}-${link.targetId}-${link.object}`} className="graph-details-text">
                {linkLabel(link, modules)}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="graph-details-section">
        <h3 className="graph-details-section-title">Crossing the application border</h3>
        <p className="graph-drawer-field-label">Inputs</p>
        <DataChips items={externalInputs} />
        <p className="graph-drawer-field-label">Outputs</p>
        <DataChips items={externalOutputs} />
      </section>
      {!isReadOnly && (
        <button type="button" className="graph-drawer-action" onClick={startEditing}>
          <span className="graph-drawer-action-title">Edit the application model</span>
        </button>
      )}
    </>
  );
}

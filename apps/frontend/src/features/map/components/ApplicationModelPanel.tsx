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
import { ApplicationModelView } from './ApplicationModelView';
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

const TEXT_AREA_ROWS = 3;

function formOf(model: ApplicationModel, links: ModuleLink[]): Form {
  return {
    mainJourney: model.mainJourney,
    scope: model.scope,
    businessObjects: model.businessObjects.join('\n'),
    links,
  };
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
      <ApplicationModelView
        model={model}
        links={links}
        modules={modules}
        externalInputs={externalInputs}
        externalOutputs={externalOutputs}
      />
      {!isReadOnly && (
        <button type="button" className="graph-drawer-action" onClick={startEditing}>
          <span className="graph-drawer-action-title">Edit the application model</span>
        </button>
      )}
    </>
  );
}

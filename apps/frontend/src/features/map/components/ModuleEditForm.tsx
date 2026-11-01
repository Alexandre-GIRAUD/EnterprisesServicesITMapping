import type { FormEvent } from 'react';
import type { HumanChangeReason } from '@/types/api';
import { AttributeChangeReasonFields } from './AttributeChangeReasonFields';
import { ObjectPicker } from './ObjectPicker';

export type ModuleForm = {
  description: string;
  owner: string;
  /** One actor per line. */
  actors: string;
  trigger: string;
  dataIn: string[];
  dataOut: string[];
};

type Props = {
  form: ModuleForm;
  /** The application lexicon the data fields pick from. */
  businessObjects: string[];
  onFieldChange: <K extends keyof ModuleForm>(key: K, value: ModuleForm[K]) => void;
  reason: HumanChangeReason | '';
  reasonComment: string;
  onReasonChange: (reason: HumanChangeReason | '') => void;
  onCommentChange: (comment: string) => void;
  isSaving: boolean;
  errorMessage: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
};

const TEXT_AREA_ROWS = 3;

type FieldProps = {
  label: string;
  value: string;
  disabled: boolean;
  hint?: string;
  multiline?: boolean;
  onChange: (value: string) => void;
};

function Field({ label, value, disabled, hint, multiline = false, onChange }: FieldProps) {
  return (
    <label className="graph-drawer-field">
      <span className="graph-drawer-field-label">{label}</span>
      {multiline ? (
        <textarea
          className="graph-drawer-input graph-drawer-textarea"
          value={value}
          rows={TEXT_AREA_ROWS}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        />
      ) : (
        <input
          className="graph-drawer-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        />
      )}
      {hint ? <span className="graph-drawer-field-hint">{hint}</span> : null}
    </label>
  );
}

/** Edit form of one functional module: its details, then the change reason that feeds the history. */
export function ModuleEditForm({
  form,
  businessObjects,
  onFieldChange,
  reason,
  reasonComment,
  onReasonChange,
  onCommentChange,
  isSaving,
  errorMessage,
  onSubmit,
  onCancel,
}: Props) {
  return (
    <form className="graph-drawer-form" onSubmit={onSubmit}>
      <Field
        label="What it does"
        value={form.description}
        multiline
        hint="In business words, one or two sentences."
        disabled={isSaving}
        onChange={(value) => onFieldChange('description', value)}
      />
      <Field
        label="Business owner"
        value={form.owner}
        disabled={isSaving}
        onChange={(value) => onFieldChange('owner', value)}
      />
      <Field
        label="Who uses it"
        value={form.actors}
        multiline
        hint="Actors or teams, one per line."
        disabled={isSaving}
        onChange={(value) => onFieldChange('actors', value)}
      />
      <Field
        label="When it acts"
        value={form.trigger}
        hint="Real time, end of day, on an event..."
        disabled={isSaving}
        onChange={(value) => onFieldChange('trigger', value)}
      />
      <ObjectPicker
        label="Business objects consumed (in)"
        options={businessObjects}
        selected={form.dataIn}
        disabled={isSaving}
        onChange={(value) => onFieldChange('dataIn', value)}
      />
      <ObjectPicker
        label="Business objects produced (out)"
        options={businessObjects}
        selected={form.dataOut}
        disabled={isSaving}
        onChange={(value) => onFieldChange('dataOut', value)}
      />
      <AttributeChangeReasonFields
        reason={reason}
        reasonComment={reasonComment}
        onReasonChange={onReasonChange}
        onCommentChange={onCommentChange}
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
        <button type="button" className="graph-drawer-action" onClick={onCancel} disabled={isSaving}>
          <span className="graph-drawer-action-title">Cancel</span>
        </button>
      </div>
    </form>
  );
}

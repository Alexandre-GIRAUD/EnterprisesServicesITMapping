import type { DragEvent } from 'react';
import type { DataModelDetection, DataModelFieldDto, DataModelTarget } from '@/types/api';
import {
  isControlledField,
  isRowDirty,
  normalizeDetection,
  validateAllowedValues,
  type AttributeRow,
} from '../dataModelAttributes';
import { normalizeDataModelTarget, type DataModelSurface } from '../dataModelSurface';
import { DataModelIcon } from './DataModelIcons';

export type AttributeRowChange = { draft?: Partial<DataModelFieldDto>; allowedValuesText?: string };

type DataModelAttributeRowProps = {
  row: AttributeRow;
  rowError: string | null;
  surface: DataModelSurface;
  isExpanded: boolean;
  isAdmin: boolean;
  isBusy: boolean;
  isDropTarget: boolean;
  onToggle: () => void;
  onChange: (change: AttributeRowChange) => void;
  onSave: () => void;
  onDiscard: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDrop: () => void;
};

const TARGET_HINTS: Partial<Record<DataModelTarget, string>> = {
  NODE: 'Stored on the Application node: filled by AI, filterable on the map and editable in the details drawer.',
  NODE_REF:
    'Allowed values become catalogue entries linked with CLASSIFIED_AS. AI and the details drawer can only pick from them.',
};

function DetectionBadge({ detection }: { detection?: DataModelDetection }) {
  const isManual = normalizeDetection(detection) === 'MANUAL';
  return (
    <span className={`data-model-badge ${isManual ? 'is-manual' : 'is-ai'}`}>
      {isManual ? null : <DataModelIcon name="sparkle" size={12} />}
      {isManual ? 'Manual' : 'AI detection'}
    </span>
  );
}

function RowStatusChips({ row, rowError }: { row: AttributeRow; rowError: string | null }) {
  return (
    <span className="data-model-row-chips">
      {rowError ? (
        <span className="data-model-chip is-error" title={rowError}>
          <DataModelIcon name="alert" size={12} />
          Invalid
        </span>
      ) : null}
      {isRowDirty(row) ? <span className="data-model-chip is-unsaved">Unsaved changes</span> : null}
      {row.draft.required ? <span className="data-model-chip">Required</span> : null}
      {isControlledField(row.draft) ? (
        <span className="data-model-chip is-controlled">
          <DataModelIcon name="check" size={12} />
          Controlled values
        </span>
      ) : null}
    </span>
  );
}

function RowMenu({ row, onDiscard, onDelete }: Pick<DataModelAttributeRowProps, 'row' | 'onDiscard' | 'onDelete'>) {
  return (
    <details className="data-model-row-menu" onClick={(event) => event.stopPropagation()}>
      <summary className="data-model-icon-btn" aria-label="Attribute actions">
        <DataModelIcon name="more" />
      </summary>
      <div
        className="data-model-row-menu-panel"
        onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')}
      >
        <button type="button" onClick={onDiscard} disabled={!row.saved || !isRowDirty(row)}>
          Discard changes
        </button>
        <button type="button" className="is-danger" onClick={onDelete}>
          Delete attribute
        </button>
      </div>
    </details>
  );
}

function RowHeader(props: DataModelAttributeRowProps) {
  const { row, rowError, isExpanded, isAdmin, isBusy, onToggle, onSave, onDragStart } = props;
  const canSave = isAdmin && !isBusy && !rowError && isRowDirty(row);
  const startDrag = (event: DragEvent) => {
    event.dataTransfer.effectAllowed = 'move';
    onDragStart();
  };

  return (
    <div className="data-model-row-header" onClick={onToggle} draggable={isAdmin} onDragStart={startDrag}>
      {isAdmin ? (
        <span className="data-model-row-grip" title="Drag to reorder">
          <DataModelIcon name="grip" />
        </span>
      ) : null}
      <span className="data-model-row-icon">
        <DataModelIcon name="tag" />
      </span>
      <span className="data-model-row-key">{row.draft.key || 'New attribute'}</span>
      <span className="data-model-row-label">{row.draft.label}</span>
      <DetectionBadge detection={row.draft.detection} />
      <span className="data-model-row-spacer" />
      {isExpanded && isAdmin ? (
        <>
          {isRowDirty(row) ? <span className="data-model-chip is-unsaved">Unsaved changes</span> : null}
          <button
            type="button"
            className="data-model-primary-btn"
            disabled={!canSave}
            onClick={(event) => {
              event.stopPropagation();
              onSave();
            }}
          >
            {isBusy ? 'Saving…' : 'Save'}
          </button>
          <RowMenu {...props} />
        </>
      ) : (
        <RowStatusChips row={row} rowError={rowError} />
      )}
      <button
        type="button"
        className={`data-model-icon-btn data-model-row-chevron${isExpanded ? ' is-open' : ''}`}
        aria-expanded={isExpanded}
        aria-label={isExpanded ? 'Collapse attribute' : 'Expand attribute'}
      >
        <DataModelIcon name="chevronDown" />
      </button>
    </div>
  );
}

function DetectionAndTargetFields({ row, surface, isAdmin, onChange }: DataModelAttributeRowProps) {
  const isManual = normalizeDetection(row.draft.detection) === 'MANUAL';
  const target = normalizeDataModelTarget(row.draft.target);
  const targetHint = TARGET_HINTS[target];

  return (
    <>
      <label className="data-model-label">
        Detection mode
        <select
          className="data-model-input"
          value={normalizeDetection(row.draft.detection)}
          onChange={(event) => onChange({ draft: { detection: event.target.value as DataModelDetection } })}
          disabled={!isAdmin}
        >
          <option value="AUTOMATIC_DETECTION">AI detection</option>
          <option value="MANUAL">Manual</option>
        </select>
        {isManual ? (
          <span className="data-model-field-hint">
            <DataModelIcon name="alert" size={14} />
            Not analyzed by AI suggestions in manual mode.
          </span>
        ) : null}
      </label>
      {surface === 'app' ? (
        <label className="data-model-label">
          Target
          <select
            className="data-model-input"
            value={target}
            onChange={(event) => onChange({ draft: { target: event.target.value as DataModelTarget } })}
            disabled={!isAdmin}
          >
            <option value="NODE">Application (node)</option>
            <option value="NODE_REF">Application (reference)</option>
          </select>
          {targetHint ? <span className="data-model-field-note">{targetHint}</span> : null}
        </label>
      ) : null}
    </>
  );
}

function AttributeOptions({ row, isAdmin, onChange, onDelete }: DataModelAttributeRowProps) {
  const isManual = normalizeDetection(row.draft.detection) === 'MANUAL';
  const isReference = normalizeDataModelTarget(row.draft.target) === 'NODE_REF';

  return (
    <div className="data-model-checks">
      <label className="data-model-check">
        <input
          type="checkbox"
          checked={isControlledField(row.draft)}
          onChange={(event) => onChange({ draft: { enforceEnum: event.target.checked } })}
          disabled={!isAdmin || isReference}
        />
        Controlled values{isReference ? ' (always on for references)' : ''}
      </label>
      <label className="data-model-check">
        <input
          type="checkbox"
          checked={Boolean(row.draft.multiple)}
          onChange={(event) => onChange({ draft: { multiple: event.target.checked } })}
          disabled={!isAdmin}
        />
        Multiple values
      </label>
      <label className="data-model-check">
        <input
          type="checkbox"
          checked={row.draft.required}
          onChange={(event) => onChange({ draft: { required: event.target.checked } })}
          disabled={!isAdmin || isManual}
        />
        Required{isManual ? ' (ignored in manual mode)' : ''}
      </label>
      {isAdmin ? (
        <button type="button" className="data-model-remove-btn" onClick={onDelete}>
          <DataModelIcon name="trash" size={14} />
          Delete attribute
        </button>
      ) : null}
    </div>
  );
}

function AttributeForm(props: DataModelAttributeRowProps) {
  const { row, rowError, isAdmin, onChange } = props;
  const isManual = normalizeDetection(row.draft.detection) === 'MANUAL';
  const allowedValuesError = validateAllowedValues(row.allowedValuesText, row.draft);
  const isPristineNewRow = !row.saved && !row.draft.key && !row.draft.label;
  const formError = isPristineNewRow || rowError === allowedValuesError ? null : rowError;

  return (
    <div className="data-model-row-body">
      <div className="data-model-field-row">
        {row.saved ? null : (
          <label className="data-model-label">
            Key
            <input
              className="data-model-input"
              value={row.draft.key}
              onChange={(event) => onChange({ draft: { key: event.target.value } })}
              placeholder="product_line"
              disabled={!isAdmin}
              spellCheck={false}
              autoFocus
            />
          </label>
        )}
        <label className="data-model-label">
          Label
          <input
            className="data-model-input"
            value={row.draft.label}
            onChange={(event) => onChange({ draft: { label: event.target.value } })}
            placeholder="Product line"
            disabled={!isAdmin}
          />
        </label>
        <DetectionAndTargetFields {...props} />
      </div>
      <label className="data-model-label">
        Description
        <textarea
          className="data-model-textarea"
          value={row.draft.description ?? ''}
          onChange={(event) => onChange({ draft: { description: event.target.value } })}
          rows={2}
          disabled={!isAdmin}
        />
      </label>
      <label className="data-model-label">
        Detection hint
        <textarea
          className="data-model-textarea"
          value={row.draft.promptHint ?? ''}
          onChange={(event) => onChange({ draft: { promptHint: event.target.value } })}
          rows={2}
          placeholder="Where the AI should look, e.g. application.yml, README, DTO javadoc"
          disabled={!isAdmin || isManual}
        />
      </label>
      <label className="data-model-label">
        Allowed values (comma-separated)
        <input
          className={`data-model-input${allowedValuesError ? ' is-invalid' : ''}`}
          value={row.allowedValuesText}
          onChange={(event) => onChange({ allowedValuesText: event.target.value })}
          placeholder="VALUE_A, VALUE_B"
          aria-invalid={Boolean(allowedValuesError)}
          disabled={!isAdmin}
        />
        {allowedValuesError ? <span className="data-model-error">{allowedValuesError}</span> : null}
      </label>
      <AttributeOptions {...props} />
      {formError ? <p className="data-model-error">{formError}</p> : null}
    </div>
  );
}

export function DataModelAttributeRow(props: DataModelAttributeRowProps) {
  const { isExpanded, isDropTarget, onDragEnter, onDrop } = props;
  const allowDrop = (event: DragEvent) => event.preventDefault();

  return (
    <article
      className={`data-model-row${isExpanded ? ' is-expanded' : ''}${isDropTarget ? ' is-drop-target' : ''}`}
      onDragEnter={onDragEnter}
      onDragOver={allowDrop}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
    >
      <RowHeader {...props} />
      {isExpanded ? <AttributeForm {...props} /> : null}
    </article>
  );
}

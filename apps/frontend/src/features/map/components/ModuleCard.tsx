import { forwardRef, type ReactNode } from 'react';
import { filledDetailKeys, type ModuleDetails, type ModuleDetailsField } from '../utils/moduleDetails';
import { moduleTone } from './graphTheme';

const NO_DATA_TEXT = 'No data declared.';
const NO_DESCRIPTION_TEXT = 'No description provided.';
const NO_OTHER_DETAIL_TEXT = 'No other detail yet. Use Edit to add them.';
const ACTOR_SEPARATOR = ', ';

const ROW_LABELS: Record<ModuleDetailsField, string> = {
  description: 'What it does',
  owner: 'Business owner',
  actors: 'Who uses it',
  trigger: 'When it acts',
  dataIn: 'Data in',
  dataOut: 'Data out',
};

export function DataChips({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="graph-details-text">{NO_DATA_TEXT}</p>;
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

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="graph-details-attribute-row">
      <dt className="graph-details-attribute-label">{label}</dt>
      <dd className="graph-details-text">{children}</dd>
    </div>
  );
}

function isDataListField(field: ModuleDetailsField): field is 'dataIn' | 'dataOut' {
  return field === 'dataIn' || field === 'dataOut';
}

function renderDetailValue(module: ModuleDetails, field: ModuleDetailsField): ReactNode {
  if (isDataListField(field)) return <DataChips items={module[field]} />;
  if (field === 'actors') return module.actors.join(ACTOR_SEPARATOR);
  return module[field];
}

type Props = {
  module: ModuleDetails & { colorSlot: number | null };
  isSelected: boolean;
  isEditing: boolean;
  canEdit: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  /** The edit form, shown in place of the details while editing. */
  editor: ReactNode;
};

/** One module in the drawer: color dot, name, what is filled in, and an Edit button. */
export const ModuleCard = forwardRef<HTMLLIElement, Props>(function ModuleCard(
  { module, isSelected, isEditing, canEdit, onToggleSelect, onEdit, editor },
  ref
) {
  const filled = filledDetailKeys(module);
  return (
    <li ref={ref} className={`module-drawer-card${isSelected ? ' is-selected' : ''}`}>
      <div className="module-drawer-card__head">
        <span
          className="module-drawer-card__dot"
          style={{ backgroundColor: moduleTone(module.colorSlot).border }}
          aria-hidden="true"
        />
        <button type="button" className="module-drawer-card__name" onClick={onToggleSelect}>
          {module.name}
        </button>
        {canEdit && !isEditing && (
          <button type="button" className="graph-drawer-action module-drawer-card__edit" onClick={onEdit}>
            <span className="graph-drawer-action-title">Edit</span>
          </button>
        )}
      </div>
      {isEditing ? (
        editor
      ) : (
        <dl className="graph-details-attribute-list">
          <Row label={ROW_LABELS.description}>{module.description || NO_DESCRIPTION_TEXT}</Row>
          {filled.map((field) => (
            <Row key={field} label={ROW_LABELS[field]}>
              {renderDetailValue(module, field)}
            </Row>
          ))}
          {filled.length === 0 && <p className="graph-details-text module-drawer-card__empty">{NO_OTHER_DETAIL_TEXT}</p>}
        </dl>
      )}
    </li>
  );
});

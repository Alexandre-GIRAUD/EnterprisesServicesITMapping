import { forwardRef, type ReactNode } from 'react';
import type { ModuleDetails } from '../utils/moduleDetails';
import { moduleTone } from './graphTheme';

export const NO_DATA_TEXT = 'No data declared.';
const NOT_SET_TEXT = 'Not set';
const NO_DESCRIPTION_TEXT = 'No description provided.';

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

/** One module in the drawer: color dot, name, details and an Edit button. */
export const ModuleCard = forwardRef<HTMLLIElement, Props>(function ModuleCard(
  { module, isSelected, isEditing, canEdit, onToggleSelect, onEdit, editor },
  ref
) {
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
          <Row label="Description">{module.description || NO_DESCRIPTION_TEXT}</Row>
          <Row label="Owner">{module.owner || NOT_SET_TEXT}</Row>
          <Row label="Technology">{module.technology || NOT_SET_TEXT}</Row>
          <Row label="Data in">
            <DataChips items={module.dataIn} />
          </Row>
          <Row label="Data out">
            <DataChips items={module.dataOut} />
          </Row>
        </dl>
      )}
    </li>
  );
});

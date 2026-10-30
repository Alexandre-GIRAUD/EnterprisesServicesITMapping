import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { LegendSetup } from './edgeColorProperty';
import { SaveSnapshotDialog } from './SaveSnapshotDialog';

type Props = {
  setups: LegendSetup[];
  onApply: (setup: LegendSetup) => void;
  onDelete: (id: string) => void;
  onSave: (name: string) => void;
};

/** One compact line: pick a saved preset (applied at once), delete it, or save the current legend. */
export function LegendPresetBar({ setups, onApply, onDelete, onSave }: Props) {
  const [selectedId, setSelectedId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  return (
    <div className="graph-legend__presets">
      <span className="graph-legend__control-label">Presets</span>
      <select
        className="graph-legend__select"
        value={selectedId}
        disabled={setups.length === 0}
        aria-label="Legend presets"
        onChange={(event) => {
          setSelectedId(event.target.value);
          const setup = setups.find((s) => s.id === event.target.value);
          if (setup) onApply(setup);
        }}
      >
        <option value="">{setups.length === 0 ? 'No preset yet' : 'Select a preset…'}</option>
        {setups.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="graph-legend__btn graph-legend__btn--danger"
        disabled={!selectedId}
        aria-label="Delete legend preset"
        onClick={() => {
          onDelete(selectedId);
          setSelectedId('');
        }}
      >
        Delete
      </button>
      <button
        type="button"
        className="graph-legend__btn graph-legend__btn--primary"
        aria-label="Save legend preset"
        onClick={() => setIsSaving(true)}
      >
        Save as new preset
      </button>
      {typeof document === 'undefined'
        ? null
        : createPortal(
            <SaveSnapshotDialog
              isOpen={isSaving}
              title="Save legend preset"
              hint="Keeps the current attributes and colors so you can reapply them later."
              placeholder="E.g. Risk by owner"
              onClose={() => setIsSaving(false)}
              onSave={async (name) => onSave(name)}
            />,
            document.body,
          )}
    </div>
  );
}

import { useState } from 'react';
import type { LegendSetup } from './edgeColorProperty';
import { LegendControlRow } from './LegendControlRow';

type Props = {
  setups: LegendSetup[];
  onApply: (setup: LegendSetup) => void;
  onDelete: (id: string) => void;
};

/** One compact line: pick a saved preset (applied at once) or delete it. */
export function LegendPresetBar({ setups, onApply, onDelete }: Props) {
  const [selectedId, setSelectedId] = useState('');

  return (
    <div className="graph-legend__presets">
      <LegendControlRow
        label="Presets"
        trailing={
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
        }
      >
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
      </LegendControlRow>
    </div>
  );
}

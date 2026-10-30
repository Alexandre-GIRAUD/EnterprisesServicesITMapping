import { useState } from 'react';
import { createPortal } from 'react-dom';
import { SaveSnapshotDialog } from './SaveSnapshotDialog';

type Props = {
  onSave: (name: string) => void;
};

/** Saves the current legend as a new preset, asking for its name. */
export function LegendPresetSave({ onSave }: Props) {
  const [isSaving, setIsSaving] = useState(false);

  return (
    <>
      <button
        type="button"
        className="graph-filter-compact-btn graph-filter-compact-btn--neutral"
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
    </>
  );
}

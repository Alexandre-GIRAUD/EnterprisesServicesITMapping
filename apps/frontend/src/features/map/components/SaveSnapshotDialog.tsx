import { type FormEvent, useEffect, useRef, useState } from 'react';

type SaveSnapshotDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
};

export function SaveSnapshotDialog({ isOpen, onClose, onSave }: SaveSnapshotDialogProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setError(null);
    setSaving(false);
    const handle = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(handle);
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Le nom est obligatoire.');
      return;
    }
    if (trimmed.length > 80) {
      setError('Le nom ne peut pas dépasser 80 caractères.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(trimmed);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  }

  return (
    <div className="save-snapshot-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="save-snapshot-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-snapshot-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="save-snapshot-dialog-title" className="save-snapshot-dialog-title">
          Enregistrer la vue
        </h2>
        <p className="save-snapshot-dialog-hint">
          Sauvegarde les filtres actuels pour les réappliquer en un clic.
        </p>
        <form onSubmit={handleSubmit}>
          <label className="save-snapshot-dialog-label" htmlFor="save-snapshot-name">
            Nom
          </label>
          <input
            ref={inputRef}
            id="save-snapshot-name"
            className="save-snapshot-dialog-input"
            type="text"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
            placeholder="Ex. Retail EMEA 2024"
          />
          {error ? <p className="save-snapshot-dialog-error">{error}</p> : null}
          <div className="save-snapshot-dialog-actions">
            <button
              type="button"
              className="save-snapshot-dialog-btn save-snapshot-dialog-btn--secondary"
              onClick={onClose}
              disabled={saving}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="save-snapshot-dialog-btn save-snapshot-dialog-btn--primary"
              disabled={saving}
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

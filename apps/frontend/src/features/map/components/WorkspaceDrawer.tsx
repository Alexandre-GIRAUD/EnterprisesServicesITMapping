import { type FormEvent, useMemo, useState } from 'react';
import type { ApplicationResponse } from '@/types/api';
import { useCreateApplicationNode } from '../hooks/useCreateApplicationNode';

type WorkspaceDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  onNodeCreated?: (application: ApplicationResponse) => void;
};

type DrawerView = 'menu' | 'add-node-form';

type AddNodeFormState = {
  name: string;
  description: string;
  validFrom: string;
  validTo: string;
};

const DEFAULT_FORM_STATE: AddNodeFormState = {
  name: '',
  description: '',
  validFrom: '',
  validTo: '',
};

const DRAWER_ACTIONS = ['Add Node', 'Add Edge', 'Profile', 'Settings'] as const;

export function WorkspaceDrawer({ isOpen, onClose, onNodeCreated }: WorkspaceDrawerProps) {
  const [view, setView] = useState<DrawerView>('menu');
  const [formState, setFormState] = useState<AddNodeFormState>(DEFAULT_FORM_STATE);
  const [localError, setLocalError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const { createNode, isSubmitting, error } = useCreateApplicationNode();

  const feedback = localError ?? error ?? feedbackMessage;
  const feedbackClassName = useMemo(() => {
    if (localError || error) return 'graph-drawer-feedback graph-drawer-feedback-error';
    if (feedbackMessage) return 'graph-drawer-feedback graph-drawer-feedback-success';
    return 'graph-drawer-feedback';
  }, [error, feedbackMessage, localError]);

  function updateField(field: keyof AddNodeFormState, value: string) {
    setFormState((prev) => ({ ...prev, [field]: value }));
    setLocalError(null);
    setFeedbackMessage(null);
  }

  function openAddNodeForm() {
    setView('add-node-form');
    setLocalError(null);
    setFeedbackMessage(null);
  }

  function closeDrawer() {
    setView('menu');
    setLocalError(null);
    setFeedbackMessage(null);
    onClose();
  }

  function cancelAddNode() {
    setView('menu');
    setLocalError(null);
    setFeedbackMessage(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = formState.name.trim();
    if (!normalizedName) {
      setLocalError('Le champ name est obligatoire.');
      return;
    }

    const created = await createNode({
      name: normalizedName,
      description: formState.description.trim() || undefined,
      validFrom: formState.validFrom,
      validTo: formState.validTo,
    });

    if (!created) return;

    setFormState(DEFAULT_FORM_STATE);
    setLocalError(null);
    setFeedbackMessage(`Node "${created.name}" créé avec succès.`);
    onNodeCreated?.(created);
    setView('menu');
  }

  return (
    <aside
      id="graph-actions-drawer"
      className={`graph-drawer${isOpen ? ' is-open' : ''}`}
      aria-label="Panneau latéral des actions"
    >
      <header className="graph-drawer-header">
        <p className="graph-drawer-eyebrow">Workspace</p>
        <div className="graph-drawer-title-row">
          <div>
            <h2 className="graph-drawer-title">{view === 'menu' ? 'Actions' : 'Create Node'}</h2>
            <p className="graph-drawer-description">
              {view === 'menu'
                ? 'Préparez vos prochaines opérations depuis un panneau latéral sobre et moderne.'
                : 'Créez un nœud Application avec les attributs temporels attendus.'}
            </p>
          </div>
          <button
            type="button"
            className="graph-drawer-close"
            onClick={closeDrawer}
            aria-label="Fermer le panneau"
          >
            x
          </button>
        </div>
      </header>

      {feedback && (
        <p className={feedbackClassName} role="status" aria-live="polite">
          {feedback}
        </p>
      )}

      {view === 'menu' ? (
        <div className="graph-drawer-actions" role="list">
          {DRAWER_ACTIONS.map((action) => (
            <button
              key={action}
              type="button"
              className="graph-drawer-action"
              role="listitem"
              onClick={action === 'Add Node' ? openAddNodeForm : undefined}
            >
              <span className="graph-drawer-action-title">{action}</span>
              <span className="graph-drawer-action-meta">{action === 'Add Node' ? 'Open' : 'Soon'}</span>
            </button>
          ))}
        </div>
      ) : (
        <form className="graph-drawer-form" onSubmit={onSubmit}>
          <label className="graph-drawer-field">
            <span className="graph-drawer-field-label">Name</span>
            <input
              className="graph-drawer-input"
              type="text"
              value={formState.name}
              onChange={(e) => updateField('name', e.target.value)}
              required
              placeholder="Ex: Billing API"
            />
          </label>

          <label className="graph-drawer-field">
            <span className="graph-drawer-field-label">Description</span>
            <textarea
              className="graph-drawer-input graph-drawer-textarea"
              value={formState.description}
              onChange={(e) => updateField('description', e.target.value)}
              rows={3}
              placeholder="Contexte fonctionnel du nœud"
            />
          </label>

          <label className="graph-drawer-field">
            <span className="graph-drawer-field-label">validFrom</span>
            <input
              className="graph-drawer-input"
              type="datetime-local"
              value={formState.validFrom}
              onChange={(e) => updateField('validFrom', e.target.value)}
            />
          </label>

          <label className="graph-drawer-field">
            <span className="graph-drawer-field-label">validTo</span>
            <input
              className="graph-drawer-input"
              type="datetime-local"
              value={formState.validTo}
              onChange={(e) => updateField('validTo', e.target.value)}
            />
          </label>

          <div className="graph-drawer-form-actions">
            <button
              type="submit"
              className="graph-drawer-action graph-drawer-action-primary"
              disabled={isSubmitting}
            >
              <span className="graph-drawer-action-title">
                {isSubmitting ? 'Creating…' : 'Create Node'}
              </span>
            </button>
            <button type="button" className="graph-drawer-action" onClick={cancelAddNode}>
              <span className="graph-drawer-action-title">Cancel</span>
            </button>
          </div>
        </form>
      )}
    </aside>
  );
}

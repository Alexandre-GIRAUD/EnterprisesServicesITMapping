import { type FormEvent, type KeyboardEvent, useEffect, useMemo, useState } from 'react';
import type { ApplicationResponse, GraphEdgeCreateResponse } from '@/types/api';
import { fetchApplications } from '../api/applicationsApi';
import { useCreateApplicationNode } from '../hooks/useCreateApplicationNode';
import { useCreateGraphEdge } from '../hooks/useCreateGraphEdge';

type WorkspaceDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  onNodeCreated?: (application: ApplicationResponse) => void;
  onEdgeCreated?: (edge: GraphEdgeCreateResponse) => string | null;
};

type DrawerView = 'menu' | 'add-node-form' | 'add-edge-form';

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

type AddEdgeFormState = {
  sourceQuery: string;
  targetQuery: string;
  type: string;
  validFrom: string;
  validTo: string;
};

const DEFAULT_EDGE_FORM_STATE: AddEdgeFormState = {
  sourceQuery: '',
  targetQuery: '',
  type: 'DEPENDS_ON',
  validFrom: '',
  validTo: '',
};

const DRAWER_ACTIONS = ['Add Node', 'Add Edge', 'Profile', 'Settings'] as const;

export function WorkspaceDrawer({
  isOpen,
  onClose,
  onNodeCreated,
  onEdgeCreated,
}: WorkspaceDrawerProps) {
  const [view, setView] = useState<DrawerView>('menu');
  const [nodeFormState, setNodeFormState] = useState<AddNodeFormState>(DEFAULT_FORM_STATE);
  const [edgeFormState, setEdgeFormState] = useState<AddEdgeFormState>(DEFAULT_EDGE_FORM_STATE);
  const [selectedSourceApp, setSelectedSourceApp] = useState<ApplicationResponse | null>(null);
  const [selectedTargetApp, setSelectedTargetApp] = useState<ApplicationResponse | null>(null);
  const [allApps, setAllApps] = useState<ApplicationResponse[] | null>(null);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSourceSuggestionsOpen, setIsSourceSuggestionsOpen] = useState(false);
  const [isTargetSuggestionsOpen, setIsTargetSuggestionsOpen] = useState(false);
  const [debouncedSourceQuery, setDebouncedSourceQuery] = useState('');
  const [debouncedTargetQuery, setDebouncedTargetQuery] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const {
    createNode,
    isSubmitting: isNodeSubmitting,
    error: nodeError,
  } = useCreateApplicationNode();
  const {
    createEdge,
    isSubmitting: isEdgeSubmitting,
    error: edgeError,
  } = useCreateGraphEdge();
  const isSubmitting = isNodeSubmitting || isEdgeSubmitting;
  const backendError = nodeError ?? edgeError ?? searchError;

  const feedback = localError ?? backendError ?? feedbackMessage;
  const feedbackClassName = useMemo(() => {
    if (localError || backendError) return 'graph-drawer-feedback graph-drawer-feedback-error';
    if (feedbackMessage) return 'graph-drawer-feedback graph-drawer-feedback-success';
    return 'graph-drawer-feedback';
  }, [backendError, feedbackMessage, localError]);

  function updateNodeField(field: keyof AddNodeFormState, value: string) {
    setNodeFormState((prev) => ({ ...prev, [field]: value }));
    setLocalError(null);
    setFeedbackMessage(null);
  }

  function updateEdgeField(field: keyof AddEdgeFormState, value: string) {
    setEdgeFormState((prev) => ({ ...prev, [field]: value }));
    if (field === 'sourceQuery') {
      setSelectedSourceApp(null);
      setIsSourceSuggestionsOpen(Boolean(value.trim()));
      setIsTargetSuggestionsOpen(false);
    }
    if (field === 'targetQuery') {
      setSelectedTargetApp(null);
      setIsTargetSuggestionsOpen(Boolean(value.trim()));
      setIsSourceSuggestionsOpen(false);
    }
    setLocalError(null);
    setFeedbackMessage(null);
  }

  function openAddNodeForm() {
    setView('add-node-form');
    setLocalError(null);
    setFeedbackMessage(null);
  }

  function openAddEdgeForm() {
    setView('add-edge-form');
    setLocalError(null);
    setFeedbackMessage(null);
  }

  function closeDrawer() {
    setView('menu');
    setLocalError(null);
    setFeedbackMessage(null);
    onClose();
  }

  function cancelForm() {
    setView('menu');
    setLocalError(null);
    setFeedbackMessage(null);
    setSearchError(null);
    setSearchStatus('idle');
    setIsSourceSuggestionsOpen(false);
    setIsTargetSuggestionsOpen(false);
    setSelectedSourceApp(null);
    setSelectedTargetApp(null);
    setEdgeFormState(DEFAULT_EDGE_FORM_STATE);
  }

  useEffect(() => {
    if (view !== 'add-edge-form') return;
    const handle = window.setTimeout(() => {
      setDebouncedSourceQuery(edgeFormState.sourceQuery.trim());
      setDebouncedTargetQuery(edgeFormState.targetQuery.trim());
    }, 250);
    return () => window.clearTimeout(handle);
  }, [edgeFormState.sourceQuery, edgeFormState.targetQuery, view]);

  useEffect(() => {
    if (view !== 'add-edge-form') return;
    if (!debouncedSourceQuery && !debouncedTargetQuery) {
      setSearchStatus('idle');
      setSearchError(null);
      return;
    }
    if (allApps) {
      setSearchStatus('ready');
      setSearchError(null);
      return;
    }

    let cancelled = false;
    setSearchStatus('loading');
    setSearchError(null);
    void fetchApplications()
      .then((apps) => {
        if (cancelled) return;
        setAllApps(apps);
        setSearchStatus('ready');
      })
      .catch((e) => {
        if (cancelled) return;
        setSearchStatus('error');
        setSearchError(e instanceof Error ? e.message : 'Impossible de charger les applications');
      });

    return () => {
      cancelled = true;
    };
  }, [allApps, debouncedSourceQuery, debouncedTargetQuery, view]);

  const filterApps = useMemo(() => {
    return (query: string) => {
      if (!query || !allApps) return [];
      const q = query.toLowerCase();
      return allApps
        .filter((app) => {
          const name = app.name.toLowerCase();
          const description = (app.description ?? '').toLowerCase();
          return name.includes(q) || description.includes(q) || app.id.toLowerCase().includes(q);
        })
        .slice(0, 8);
    };
  }, [allApps]);

  const filteredSourceApps = useMemo(() => {
    return filterApps(debouncedSourceQuery);
  }, [debouncedSourceQuery, filterApps]);

  const filteredTargetApps = useMemo(() => {
    return filterApps(debouncedTargetQuery);
  }, [debouncedTargetQuery, filterApps]);

  function chooseSourceApp(app: ApplicationResponse) {
    setSelectedSourceApp(app);
    setEdgeFormState((prev) => ({ ...prev, sourceQuery: app.name }));
    setIsSourceSuggestionsOpen(false);
    setIsTargetSuggestionsOpen(false);
    setSearchError(null);
    setLocalError(null);
  }

  function chooseTargetApp(app: ApplicationResponse) {
    setSelectedTargetApp(app);
    setEdgeFormState((prev) => ({ ...prev, targetQuery: app.name }));
    setIsTargetSuggestionsOpen(false);
    setIsSourceSuggestionsOpen(false);
    setSearchError(null);
    setLocalError(null);
  }

  function onSourceKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setIsSourceSuggestionsOpen(false);
      return;
    }
    if (event.key === 'Enter' && isSourceSuggestionsOpen && filteredSourceApps.length > 0) {
      event.preventDefault();
      chooseSourceApp(filteredSourceApps[0]);
    }
  }

  function onTargetKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setIsTargetSuggestionsOpen(false);
      return;
    }
    if (event.key === 'Enter' && isTargetSuggestionsOpen && filteredTargetApps.length > 0) {
      event.preventDefault();
      chooseTargetApp(filteredTargetApps[0]);
    }
  }

  async function onSubmitNode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = nodeFormState.name.trim();
    if (!normalizedName) {
      setLocalError('Le champ name est obligatoire.');
      return;
    }

    const created = await createNode({
      name: normalizedName,
      description: nodeFormState.description.trim() || undefined,
      validFrom: nodeFormState.validFrom,
      validTo: nodeFormState.validTo,
    });

    if (!created) return;

    setNodeFormState(DEFAULT_FORM_STATE);
    setLocalError(null);
    setFeedbackMessage(`Node "${created.name}" créé avec succès.`);
    onNodeCreated?.(created);
    setView('menu');
  }

  async function onSubmitEdge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sourceId = selectedSourceApp?.id;
    const targetId = selectedTargetApp?.id;
    const type = edgeFormState.type.trim();

    if (!sourceId || !targetId || !type) {
      setLocalError('Source application, target application et type sont obligatoires.');
      return;
    }
    if (sourceId === targetId) {
      setLocalError('sourceId et targetId doivent etre differents.');
      return;
    }

    const created = await createEdge({
      sourceId,
      targetId,
      type,
      validFrom: edgeFormState.validFrom,
      validTo: edgeFormState.validTo,
    });
    if (!created) return;

    const graphValidationMessage = onEdgeCreated?.(created);
    if (graphValidationMessage) {
      setLocalError(graphValidationMessage);
      return;
    }

    setEdgeFormState(DEFAULT_EDGE_FORM_STATE);
    setSelectedSourceApp(null);
    setSelectedTargetApp(null);
    setIsSourceSuggestionsOpen(false);
    setIsTargetSuggestionsOpen(false);
    setLocalError(null);
    setFeedbackMessage(
      `Edge "${created.type}" créé entre "${created.sourceId}" et "${created.targetId}".`
    );
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
            <h2 className="graph-drawer-title">
              {view === 'menu' ? 'Actions' : view === 'add-node-form' ? 'Create Node' : 'Create Edge'}
            </h2>
            <p className="graph-drawer-description">
              {view === 'menu'
                ? 'Préparez vos prochaines opérations depuis un panneau latéral sobre et moderne.'
                : view === 'add-node-form'
                  ? 'Créez un nœud Application avec les attributs temporels attendus.'
                  : 'Créez une relation typée entre deux nœuds déjà visibles dans le graphe.'}
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
              onClick={
                action === 'Add Node'
                  ? openAddNodeForm
                  : action === 'Add Edge'
                    ? openAddEdgeForm
                    : undefined
              }
            >
              <span className="graph-drawer-action-title">{action}</span>
              <span className="graph-drawer-action-meta">
                {action === 'Add Node' || action === 'Add Edge' ? 'Open' : 'Soon'}
              </span>
            </button>
          ))}
        </div>
      ) : view === 'add-node-form' ? (
        <form className="graph-drawer-form" onSubmit={onSubmitNode}>
          <label className="graph-drawer-field">
            <span className="graph-drawer-field-label">Name</span>
            <input
              className="graph-drawer-input"
              type="text"
              value={nodeFormState.name}
              onChange={(e) => updateNodeField('name', e.target.value)}
              required
              placeholder="Ex: Billing API"
            />
          </label>

          <label className="graph-drawer-field">
            <span className="graph-drawer-field-label">Description</span>
            <textarea
              className="graph-drawer-input graph-drawer-textarea"
              value={nodeFormState.description}
              onChange={(e) => updateNodeField('description', e.target.value)}
              rows={3}
              placeholder="Contexte fonctionnel du nœud"
            />
          </label>

          <label className="graph-drawer-field">
            <span className="graph-drawer-field-label">validFrom</span>
            <input
              className="graph-drawer-input"
              type="datetime-local"
              value={nodeFormState.validFrom}
              onChange={(e) => updateNodeField('validFrom', e.target.value)}
            />
          </label>

          <label className="graph-drawer-field">
            <span className="graph-drawer-field-label">validTo</span>
            <input
              className="graph-drawer-input"
              type="datetime-local"
              value={nodeFormState.validTo}
              onChange={(e) => updateNodeField('validTo', e.target.value)}
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
            <button type="button" className="graph-drawer-action" onClick={cancelForm}>
              <span className="graph-drawer-action-title">Cancel</span>
            </button>
          </div>
        </form>
      ) : (
        <form className="graph-drawer-form" onSubmit={onSubmitEdge}>
          <label className="graph-drawer-field">
            <span className="graph-drawer-field-label">Source application</span>
            <input
              className="graph-drawer-input"
              type="search"
              value={edgeFormState.sourceQuery}
              onChange={(e) => updateEdgeField('sourceQuery', e.target.value)}
              onFocus={() => {
                if (edgeFormState.sourceQuery.trim()) setIsSourceSuggestionsOpen(true);
                setIsTargetSuggestionsOpen(false);
              }}
              onKeyDown={onSourceKeyDown}
              aria-expanded={isSourceSuggestionsOpen}
              aria-controls="source-application-suggestions"
              autoComplete="off"
              required
              placeholder="Ex: Billing API"
            />
            {selectedSourceApp && (
              <span className="graph-drawer-field-hint">
                Selected: {selectedSourceApp.name} ({selectedSourceApp.id.slice(0, 12)}...)
              </span>
            )}
            {isSourceSuggestionsOpen && debouncedSourceQuery && (
              <div
                id="source-application-suggestions"
                className="graph-drawer-search-dropdown"
                role="listbox"
                aria-label="Suggestions applications source"
              >
                {searchStatus === 'loading' && (
                  <p className="graph-drawer-search-state">Chargement...</p>
                )}
                {searchStatus === 'error' && (
                  <p className="graph-drawer-search-error" role="alert">
                    {searchError}
                  </p>
                )}
                {searchStatus === 'ready' && filteredSourceApps.length === 0 && (
                  <p className="graph-drawer-search-state">Aucune application trouvée</p>
                )}
                {searchStatus === 'ready' &&
                  filteredSourceApps.map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      className="graph-drawer-search-item"
                      role="option"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => chooseSourceApp(app)}
                    >
                      <span className="graph-drawer-search-item-name">{app.name}</span>
                      <span className="graph-drawer-search-item-id">{app.id.slice(0, 12)}...</span>
                    </button>
                  ))}
              </div>
            )}
          </label>

          <label className="graph-drawer-field">
            <span className="graph-drawer-field-label">Target application</span>
            <input
              className="graph-drawer-input"
              type="search"
              value={edgeFormState.targetQuery}
              onChange={(e) => updateEdgeField('targetQuery', e.target.value)}
              onFocus={() => {
                if (edgeFormState.targetQuery.trim()) setIsTargetSuggestionsOpen(true);
                setIsSourceSuggestionsOpen(false);
              }}
              onKeyDown={onTargetKeyDown}
              aria-expanded={isTargetSuggestionsOpen}
              aria-controls="target-application-suggestions"
              autoComplete="off"
              required
              placeholder="Ex: Billing API"
            />
            {selectedTargetApp && (
              <span className="graph-drawer-field-hint">
                Selected: {selectedTargetApp.name} ({selectedTargetApp.id.slice(0, 12)}...)
              </span>
            )}
            {isTargetSuggestionsOpen && debouncedTargetQuery && (
              <div
                id="target-application-suggestions"
                className="graph-drawer-search-dropdown"
                role="listbox"
                aria-label="Suggestions applications cibles"
              >
                {searchStatus === 'loading' && (
                  <p className="graph-drawer-search-state">Chargement...</p>
                )}
                {searchStatus === 'error' && (
                  <p className="graph-drawer-search-error" role="alert">
                    {searchError}
                  </p>
                )}
                {searchStatus === 'ready' && filteredTargetApps.length === 0 && (
                  <p className="graph-drawer-search-state">Aucune application trouvée</p>
                )}
                {searchStatus === 'ready' &&
                  filteredTargetApps.map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      className="graph-drawer-search-item"
                      role="option"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => chooseTargetApp(app)}
                    >
                      <span className="graph-drawer-search-item-name">{app.name}</span>
                      <span className="graph-drawer-search-item-id">{app.id.slice(0, 12)}...</span>
                    </button>
                  ))}
              </div>
            )}
          </label>

          <label className="graph-drawer-field">
            <span className="graph-drawer-field-label">type</span>
            <input
              className="graph-drawer-input"
              type="text"
              value={edgeFormState.type}
              onChange={(e) => updateEdgeField('type', e.target.value)}
              required
              placeholder="DEPENDS_ON"
            />
          </label>

          <label className="graph-drawer-field">
            <span className="graph-drawer-field-label">validFrom</span>
            <input
              className="graph-drawer-input"
              type="datetime-local"
              value={edgeFormState.validFrom}
              onChange={(e) => updateEdgeField('validFrom', e.target.value)}
            />
          </label>

          <label className="graph-drawer-field">
            <span className="graph-drawer-field-label">validTo</span>
            <input
              className="graph-drawer-input"
              type="datetime-local"
              value={edgeFormState.validTo}
              onChange={(e) => updateEdgeField('validTo', e.target.value)}
            />
          </label>

          <div className="graph-drawer-form-actions">
            <button
              type="submit"
              className="graph-drawer-action graph-drawer-action-primary"
              disabled={isSubmitting}
            >
              <span className="graph-drawer-action-title">
                {isSubmitting ? 'Creating…' : 'Create Edge'}
              </span>
            </button>
            <button type="button" className="graph-drawer-action" onClick={cancelForm}>
              <span className="graph-drawer-action-title">Cancel</span>
            </button>
          </div>
        </form>
      )}
    </aside>
  );
}

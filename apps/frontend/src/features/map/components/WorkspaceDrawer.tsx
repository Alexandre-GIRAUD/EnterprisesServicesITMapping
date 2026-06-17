import { type FormEvent, type KeyboardEvent, useEffect, useMemo, useState } from 'react';
import type {
  ApplicationResponse,
  BusinessUnitCreateRequest,
  GraphEdgeCreateResponse,
} from '@/types/api';
import { createBusinessUnit } from '../api/businessUnitsApi';
import { fetchApplications } from '../api/applicationsApi';
import { useCreateApplicationNode } from '../hooks/useCreateApplicationNode';
import { useCreateGraphEdge } from '../hooks/useCreateGraphEdge';
import {
  buildSandboxApplicationResponse,
  buildSandboxEdgeResponse,
} from '../utils/sandboxGraph';

type WorkspaceDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  sandboxMode?: boolean;
  /** Graph-visible applications (includes sandbox nodes) for edge autocomplete. */
  extraApplications?: ApplicationResponse[];
  onNodeCreated?: (application: ApplicationResponse) => void;
  onEdgeCreated?: (edge: GraphEdgeCreateResponse) => string | null;
  /** After creating a BU, refresh lists (e.g. map filter dropdown). */
  onBusinessUnitsChanged?: () => void | Promise<void>;
};

type DrawerView = 'menu' | 'add-node-form' | 'add-edge-form' | 'add-bu-form';

type AddNodeFormState = {
  name: string;
  description: string;
  year: string;
};

const DEFAULT_FORM_STATE: AddNodeFormState = {
  name: '',
  description: '',
  year: '',
};

type AddEdgeFormState = {
  sourceQuery: string;
  targetQuery: string;
  type: string;
};

const DEFAULT_EDGE_FORM_STATE: AddEdgeFormState = {
  sourceQuery: '',
  targetQuery: '',
  type: 'DEPENDS_ON',
};

type AddBuFormState = {
  name: string;
  code: string;
  description: string;
};

const DEFAULT_BU_FORM_STATE: AddBuFormState = {
  name: '',
  code: '',
  description: '',
};

const DRAWER_ACTIONS = ['Add Node', 'Add Edge', 'Add Business Unit', 'Profile', 'Settings'] as const;

export function WorkspaceDrawer({
  isOpen,
  onClose,
  sandboxMode = false,
  extraApplications = [],
  onNodeCreated,
  onEdgeCreated,
  onBusinessUnitsChanged,
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
  const [buFormState, setBuFormState] = useState<AddBuFormState>(DEFAULT_BU_FORM_STATE);
  const [isBuSubmitting, setIsBuSubmitting] = useState(false);
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
  const isSubmitting = isNodeSubmitting || isEdgeSubmitting || isBuSubmitting;
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

  function openAddBuForm() {
    setView('add-bu-form');
    setLocalError(null);
    setFeedbackMessage(null);
  }

  function updateBuField(field: keyof AddBuFormState, value: string) {
    setBuFormState((prev) => ({ ...prev, [field]: value }));
    setLocalError(null);
    setFeedbackMessage(null);
  }

  async function onSubmitBu(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = buFormState.name.trim();
    if (!normalizedName) {
      setLocalError('Business unit name is required.');
      return;
    }
    const payload: BusinessUnitCreateRequest = {
      name: normalizedName,
      ...(buFormState.code.trim() ? { code: buFormState.code.trim() } : {}),
      ...(buFormState.description.trim() ? { description: buFormState.description.trim() } : {}),
    };
    try {
      setIsBuSubmitting(true);
      setLocalError(null);
      setFeedbackMessage(null);
      await createBusinessUnit(payload);
      setBuFormState(DEFAULT_BU_FORM_STATE);
      setFeedbackMessage(`Business unit "${normalizedName}" created.`);
      await onBusinessUnitsChanged?.();
      setView('menu');
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Unable to create the business unit.');
    } finally {
      setIsBuSubmitting(false);
    }
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
    setBuFormState(DEFAULT_BU_FORM_STATE);
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
    if (allApps || extraApplications.length > 0) {
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
        setSearchError(e instanceof Error ? e.message : 'Unable to load applications');
      });

    return () => {
      cancelled = true;
    };
  }, [allApps, debouncedSourceQuery, debouncedTargetQuery, extraApplications.length, view]);

  const mergedApps = useMemo(() => {
    if (!allApps) return extraApplications;
    const seen = new Set(allApps.map((a) => a.id));
    const extras = extraApplications.filter((a) => !seen.has(a.id));
    return [...allApps, ...extras];
  }, [allApps, extraApplications]);

  const filterApps = useMemo(() => {
    return (query: string) => {
      if (!query) return [];
      const q = query.toLowerCase();
      return mergedApps
        .filter((app) => {
          const name = app.name.toLowerCase();
          const description = (app.description ?? '').toLowerCase();
          return name.includes(q) || description.includes(q) || app.id.toLowerCase().includes(q);
        })
        .slice(0, 8);
    };
  }, [mergedApps]);

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
      setLocalError('The name field is required.');
      return;
    }

    const yearTrimmed = nodeFormState.year.trim();
    let yearValue: number | undefined;
    if (yearTrimmed) {
      const parsed = Number(yearTrimmed);
      if (!Number.isInteger(parsed) || parsed < 1970 || parsed > 2100) {
        setLocalError('Year must be a valid integer (1970–2100).');
        return;
      }
      yearValue = parsed;
    }

    let created: ApplicationResponse | null;
    if (sandboxMode) {
      created = buildSandboxApplicationResponse({
        name: normalizedName,
        description: nodeFormState.description.trim() || undefined,
        year: yearValue,
      });
    } else {
      created = await createNode({
        name: normalizedName,
        description: nodeFormState.description.trim() || undefined,
        year: yearValue,
      });
    }

    if (!created) return;

    setNodeFormState(DEFAULT_FORM_STATE);
    setLocalError(null);
    setFeedbackMessage(
      sandboxMode
        ? `Node "${created.name}" added (sandbox, not saved).`
        : `Node "${created.name}" created successfully.`
    );
    onNodeCreated?.(created);
    setView('menu');
  }

  async function onSubmitEdge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sourceId = selectedSourceApp?.id;
    const targetId = selectedTargetApp?.id;
    const type = edgeFormState.type.trim();

    if (!sourceId || !targetId || !type) {
      setLocalError('Source application, target application, and type are required.');
      return;
    }
    if (sourceId === targetId) {
      setLocalError('sourceId and targetId must be different.');
      return;
    }

    let created: GraphEdgeCreateResponse | null;
    if (sandboxMode) {
      created = buildSandboxEdgeResponse({ sourceId, targetId, type });
    } else {
      created = await createEdge({ sourceId, targetId, type });
    }
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
      sandboxMode
        ? `Edge "${created.type}" added (sandbox, not saved).`
        : `Edge "${created.type}" created between "${created.sourceId}" and "${created.targetId}".`
    );
    setView('menu');
  }

  return (
    <aside
      id="graph-actions-drawer"
      className={`graph-drawer graph-drawer--edit${isOpen ? ' is-open' : ''}`}
      aria-label={sandboxMode ? 'Edit panel' : 'Corrections panel'}
    >
      <header className="graph-drawer-header">
        <p className="graph-drawer-eyebrow">{sandboxMode ? 'Edit' : 'Corrections'}</p>
        <div className="graph-drawer-title-row">
          <div>
            <h2 className="graph-drawer-title">
              {view === 'menu'
                ? 'Actions'
                : view === 'add-node-form'
                  ? 'Create Node'
                  : view === 'add-edge-form'
                    ? 'Create Edge'
                    : 'New business unit'}
            </h2>
            <p className="graph-drawer-description">
              {view === 'menu'
                ? 'Prepare your next operations from a clean, modern side panel.'
                : view === 'add-node-form'
                  ? 'Create an Application node (name, description, year).'
                  : view === 'add-edge-form'
                    ? 'Create a typed relationship between two nodes already visible in the graph.'
                    : 'Create a business unit (grouping above applications).'}
            </p>
          </div>
          <button
            type="button"
            className="graph-drawer-close"
            onClick={closeDrawer}
            aria-label="Close panel"
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
          {DRAWER_ACTIONS.map((action) => {
            const isBu = action === 'Add Business Unit';
            const disabledInSandbox = sandboxMode && isBu;
            const isSoon = action === 'Profile' || action === 'Settings';
            return (
            <button
              key={action}
              type="button"
              className="graph-drawer-action"
              role="listitem"
              disabled={disabledInSandbox || isSoon}
              title={disabledInSandbox ? 'Unavailable in sandbox' : undefined}
              onClick={
                action === 'Add Node'
                  ? openAddNodeForm
                  : action === 'Add Edge'
                    ? openAddEdgeForm
                    : action === 'Add Business Unit' && !sandboxMode
                      ? openAddBuForm
                      : undefined
              }
            >
              <span className="graph-drawer-action-title">{action}</span>
              <span className="graph-drawer-action-meta">
                {disabledInSandbox
                  ? 'Sandbox'
                  : action === 'Add Node' ||
                      action === 'Add Edge' ||
                      action === 'Add Business Unit'
                    ? 'Open'
                    : 'Soon'}
              </span>
            </button>
            );
          })}
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
              placeholder="Functional context for the node"
            />
          </label>

          <label className="graph-drawer-field">
            <span className="graph-drawer-field-label">Year</span>
            <input
              className="graph-drawer-input"
              type="number"
              inputMode="numeric"
              min={1970}
              max={2100}
              placeholder="Ex: 2025"
              value={nodeFormState.year}
              onChange={(e) => updateNodeField('year', e.target.value)}
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
      ) : view === 'add-bu-form' ? (
        <form className="graph-drawer-form" onSubmit={onSubmitBu}>
          <label className="graph-drawer-field">
            <span className="graph-drawer-field-label">Name</span>
            <input
              className="graph-drawer-input"
              type="text"
              value={buFormState.name}
              onChange={(e) => updateBuField('name', e.target.value)}
              required
              placeholder="Ex: Retail France"
              disabled={isBuSubmitting}
            />
          </label>
          <label className="graph-drawer-field">
            <span className="graph-drawer-field-label">Code (optional)</span>
            <input
              className="graph-drawer-input"
              type="text"
              value={buFormState.code}
              onChange={(e) => updateBuField('code', e.target.value)}
              placeholder="Ex: RETAIL-FR"
              disabled={isBuSubmitting}
            />
          </label>
          <label className="graph-drawer-field">
            <span className="graph-drawer-field-label">Description (optional)</span>
            <textarea
              className="graph-drawer-input graph-drawer-textarea"
              value={buFormState.description}
              onChange={(e) => updateBuField('description', e.target.value)}
              rows={3}
              disabled={isBuSubmitting}
            />
          </label>
          <div className="graph-drawer-form-actions">
            <button
              type="submit"
              className="graph-drawer-action graph-drawer-action-primary"
              disabled={isBuSubmitting}
            >
              <span className="graph-drawer-action-title">
                {isBuSubmitting ? 'Creating…' : 'Create business unit'}
              </span>
            </button>
            <button type="button" className="graph-drawer-action" onClick={cancelForm} disabled={isBuSubmitting}>
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
                aria-label="Source application suggestions"
              >
                {searchStatus === 'loading' && (
                  <p className="graph-drawer-search-state">Loading...</p>
                )}
                {searchStatus === 'error' && (
                  <p className="graph-drawer-search-error" role="alert">
                    {searchError}
                  </p>
                )}
                {searchStatus === 'ready' && filteredSourceApps.length === 0 && (
                  <p className="graph-drawer-search-state">No applications found</p>
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
                aria-label="Target application suggestions"
              >
                {searchStatus === 'loading' && (
                  <p className="graph-drawer-search-state">Loading...</p>
                )}
                {searchStatus === 'error' && (
                  <p className="graph-drawer-search-error" role="alert">
                    {searchError}
                  </p>
                )}
                {searchStatus === 'ready' && filteredTargetApps.length === 0 && (
                  <p className="graph-drawer-search-state">No applications found</p>
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

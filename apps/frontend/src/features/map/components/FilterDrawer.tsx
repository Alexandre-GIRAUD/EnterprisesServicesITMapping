import { type FormEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CloseIcon } from './CloseIcon';
import type { ApplicationResponse, GraphEdgeDto, GraphFilters, GraphNodeFilterDto } from '@/types/api';
import {
  type FilterView,
  isGraphBlankedBySelection,
  keepApplicationsForCheckedFlows,
  dimensionMode,
  dimensionStatusLabel,
  nodeAttributeKeyFromView,
  nodeAttributeView,
  rootCheckboxState,
  selectAllCatalog,
  toApiFilterList,
  toggleSortedValue,
} from './filterDimensionUtils';
import { displayFilterValue, searchFilterHits, type FilterSearchHit } from './filterSearch';

export type { GraphFilters };

type FilterDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  variant?: 'overlay' | 'embedded';
  applications: ApplicationResponse[];
  /** Dimensions derived from the Data Model NODE + NODE_REF + EDGE fields. */
  nodeFilters: GraphNodeFilterDto[];
  initialApplicationIds: string[];
  initialNodeAttributes: Record<string, string[]>;
  initialNodeRefs?: Record<string, string[]>;
  initialEdgeAttributes?: Record<string, string[]>;
  initialEdgeIds?: string[];
  initialMatchNothing?: boolean;
  initialBlankedDimensions?: string[];
  edges?: GraphEdgeDto[];
  onApply: (filters: GraphFilters) => void;
  showPinView?: boolean;
  pinViewDisabled?: boolean;
  onPinView?: () => void;
};

/**
 * "All selected" and "none selected" both mean "no filter on this axis" for the API, but only
 * "all" is a valid resting state — an empty dimension would yield an empty graph, so Apply is
 * blocked until the user picks something or clears back to all.
 */
function applyRootToggle(catalog: string[], selected: string[]): string[] {
  return dimensionMode(selected, catalog) === 'none' ? selectAllCatalog(catalog) : [];
}

function statusClass(mode: ReturnType<typeof dimensionMode>): string {
  if (mode === 'some') return 'graph-filter-status is-active';
  if (mode === 'none') return 'graph-filter-status is-invalid';
  return 'graph-filter-status';
}

function isNodeRefDimension(dimension: GraphNodeFilterDto): boolean {
  return dimension.kind === 'NODE_REF';
}

function isEdgeDimension(dimension: GraphNodeFilterDto): boolean {
  return dimension.kind === 'EDGE';
}

function optionLabel(dimension: GraphNodeFilterDto, id: string): string {
  const fromOptions = dimension.options?.find((o) => o.id === id)?.name;
  const label = fromOptions && fromOptions.trim() ? fromOptions : id;
  return displayFilterValue(id, label);
}

function initialForDimension(
  dimension: GraphNodeFilterDto,
  initialNodeAttributes: Record<string, string[]>,
  initialNodeRefs: Record<string, string[]>,
  initialEdgeAttributes: Record<string, string[]>
): string[] {
  if (isNodeRefDimension(dimension)) {
    return initialNodeRefs[dimension.key] ?? [];
  }
  if (isEdgeDimension(dimension)) {
    return initialEdgeAttributes[dimension.key] ?? [];
  }
  return initialNodeAttributes[dimension.key] ?? [];
}

function matchesSearch(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystack.toLowerCase().includes(q);
}

function stopSearchSubmit(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === 'Enter') {
    event.preventDefault();
  }
}

export function FilterDrawer({
  isOpen,
  onClose,
  variant = 'overlay',
  applications,
  nodeFilters,
  initialApplicationIds,
  initialNodeAttributes,
  initialNodeRefs = {},
  initialEdgeAttributes = {},
  initialEdgeIds = [],
  initialMatchNothing = false,
  initialBlankedDimensions = [],
  edges = [],
  onApply,
  showPinView = false,
  pinViewDisabled = false,
  onPinView,
}: FilterDrawerProps) {
  const [view, setView] = useState<FilterView>('root');
  const [selectedApplicationIds, setSelectedApplicationIds] = useState(initialApplicationIds);
  const [selectedNodeValues, setSelectedNodeValues] = useState<Record<string, string[]>>({});
  const [dimensionQuery, setDimensionQuery] = useState('');
  const [valueQuery, setValueQuery] = useState('');
  const [selectedFlowIds, setSelectedFlowIds] = useState(initialEdgeIds);
  const editedRef = useRef(false);

  const appCatalog = useMemo(
    () =>
      [...applications]
        .sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id, undefined, { sensitivity: 'base' }))
        .map((a) => a.id),
    [applications]
  );

  const nodeCatalogs = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const dimension of nodeFilters) {
      out[dimension.key] = selectAllCatalog(dimension.values);
    }
    return out;
  }, [nodeFilters]);

  const appMode = dimensionMode(selectedApplicationIds, appCatalog);
  const nodeModes = useMemo(
    () =>
      nodeFilters.map((dimension) =>
        dimensionMode(selectedNodeValues[dimension.key] ?? [], nodeCatalogs[dimension.key] ?? [])
      ),
    [nodeFilters, selectedNodeValues, nodeCatalogs]
  );
  const isGraphBlank = isGraphBlankedBySelection([appMode, ...nodeModes]);

  const detailSelectAllRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      editedRef.current = false;
      return;
    }
    if (editedRef.current) return;
    const blanked =
      initialBlankedDimensions.length > 0
        ? initialBlankedDimensions
        : initialMatchNothing
          ? ['applications']
          : [];
    setView('root');
    setDimensionQuery('');
    setValueQuery('');
    setSelectedFlowIds(initialEdgeIds);
    setSelectedApplicationIds(
      blanked.includes('applications')
        ? []
        : initialApplicationIds.length > 0
          ? initialApplicationIds
          : selectAllCatalog(appCatalog)
    );
    setSelectedNodeValues(
      Object.fromEntries(
        nodeFilters.map((dimension) => {
          if (blanked.includes(dimension.key)) return [dimension.key, []];
          const initial = initialForDimension(
            dimension,
            initialNodeAttributes,
            initialNodeRefs,
            initialEdgeAttributes
          );
          return [
            dimension.key,
            initial.length > 0 ? initial : selectAllCatalog(nodeCatalogs[dimension.key] ?? []),
          ];
        })
      )
    );
  }, [
    isOpen,
    initialApplicationIds,
    initialNodeAttributes,
    initialNodeRefs,
    initialEdgeAttributes,
    initialEdgeIds,
    initialBlankedDimensions,
    initialMatchNothing,
    appCatalog,
    nodeFilters,
    nodeCatalogs,
  ]);

  useEffect(() => {
    if (!isOpen || !editedRef.current) return;
    const blanked: string[] = [];
    if (dimensionMode(selectedApplicationIds, appCatalog) === 'none') blanked.push('applications');
    for (const dimension of nodeFilters) {
      const mode = dimensionMode(
        selectedNodeValues[dimension.key] ?? [],
        nodeCatalogs[dimension.key] ?? []
      );
      if (mode === 'none') blanked.push(dimension.key);
    }
    const api = filtersForApi();
    onApply({
      applicationIds: toApiFilterList(selectedApplicationIds, appCatalog) ?? [],
      ...api,
      edgeIds: selectedFlowIds,
      matchNothing: blanked.length > 0,
      blankedDimensions: blanked,
    });
    // filtersForApi closes over the same selection state as this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedApplicationIds, selectedNodeValues, selectedFlowIds, isOpen]);

  const detailKey = nodeAttributeKeyFromView(view);
  const detailDimension = nodeFilters.find((dimension) => dimension.key === detailKey) ?? null;
  const detailMode =
    view === 'applications'
      ? appMode
      : detailDimension
        ? dimensionMode(
            selectedNodeValues[detailDimension.key] ?? [],
            nodeCatalogs[detailDimension.key] ?? []
          )
        : 'none';

  useEffect(() => {
    const el = detailSelectAllRef.current;
    if (el && view !== 'root') {
      el.indeterminate = rootCheckboxState(detailMode) === 'indeterminate';
    }
  }, [detailMode, view]);

  function openDetail(next: FilterView) {
    setValueQuery('');
    setView(next);
  }

  function clearDetailDimension() {
    editedRef.current = true;
    if (view === 'applications') {
      setSelectedApplicationIds(selectAllCatalog(appCatalog));
      return;
    }
    if (detailDimension) {
      setSelectedNodeValues((prev) => ({
        ...prev,
        [detailDimension.key]: selectAllCatalog(nodeCatalogs[detailDimension.key] ?? []),
      }));
    }
  }

  function confirmDetailDimension() {
    setView('root');
  }

  function filtersForApi(): Pick<GraphFilters, 'nodeAttributes' | 'nodeRefs' | 'edgeAttributes'> {
    const nodeAttributes: Record<string, string[]> = {};
    const nodeRefs: Record<string, string[]> = {};
    const edgeAttributes: Record<string, string[]> = {};
    for (const dimension of nodeFilters) {
      const selected = toApiFilterList(
        selectedNodeValues[dimension.key] ?? [],
        nodeCatalogs[dimension.key] ?? []
      );
      if (!selected || selected.length === 0) continue;
      if (isNodeRefDimension(dimension)) {
        nodeRefs[dimension.key] = selected;
      } else if (isEdgeDimension(dimension)) {
        edgeAttributes[dimension.key] = selected;
      } else {
        nodeAttributes[dimension.key] = selected;
      }
    }
    return { nodeAttributes, nodeRefs, edgeAttributes };
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  function onReset() {
    editedRef.current = true;
    setSelectedFlowIds([]);
    setSelectedApplicationIds(selectAllCatalog(appCatalog));
    setSelectedNodeValues(
      Object.fromEntries(
        nodeFilters.map((dimension) => [
          dimension.key,
          selectAllCatalog(nodeCatalogs[dimension.key] ?? []),
        ])
      )
    );
    setView('root');
  }

  function renderRootActions() {
    return (
      <div className="graph-filter-compact-actions">
        <button type="button" className="graph-filter-compact-btn" onClick={onReset}>
          Clear
        </button>
        {showPinView && onPinView ? (
          <button
            type="button"
            className="graph-filter-compact-btn graph-filter-compact-btn--pin"
            onClick={onPinView}
            disabled={pinViewDisabled}
            aria-disabled={pinViewDisabled}
            title={
              pinViewDisabled
                ? 'Wait for the graph to load before pinning a view'
                : 'Pin current view (filters, hidden apps, layout)'
            }
          >
            Pin view
          </button>
        ) : null}
      </div>
    );
  }

  function renderDetailViewActions() {
    const selectedCount =
      view === 'applications'
        ? selectedApplicationIds.length
        : detailDimension
          ? (selectedNodeValues[detailDimension.key] ?? []).length
          : 0;
    const doneLabel = detailMode === 'some' ? `Done (${selectedCount})` : 'Done';

    return (
      <div className="graph-filter-compact-actions">
        <button type="button" className="graph-filter-compact-btn" onClick={clearDetailDimension}>
          Clear
        </button>
        <button
          type="button"
          className="graph-filter-compact-btn graph-filter-compact-btn--primary"
          onClick={confirmDetailDimension}
        >
          {doneLabel}
        </button>
      </div>
    );
  }

  function renderApplicationsDetail() {
    const filteredApps = applications.filter((app) =>
      matchesSearch(`${app.name ?? ''} ${app.id}`, valueQuery)
    );

    return (
      <div className="graph-filter-detail-panel">
        <div className="graph-filter-search">
          <input
            type="search"
            className="graph-filter-search-input"
            value={valueQuery}
            onChange={(e) => setValueQuery(e.target.value)}
            placeholder="Search applications…"
            aria-label="Search applications"
            onKeyDown={stopSearchSubmit}
          />
        </div>
        <div className="graph-drawer-region-checkboxes graph-filter-detail-list">
          <label className="graph-drawer-checkbox-row graph-filter-select-all-row">
            <input
              ref={detailSelectAllRef}
              type="checkbox"
              checked={rootCheckboxState(appMode) === 'checked'}
              onChange={() => {
                editedRef.current = true;
                setSelectedApplicationIds(applyRootToggle(appCatalog, selectedApplicationIds));
              }}
            />
            <span>Select all</span>
          </label>
          {filteredApps.length === 0 ? (
            <p className="graph-filter-hint graph-filter-search-empty" role="status">
              No application matches “{valueQuery.trim()}”.
            </p>
          ) : (
            filteredApps.map((app) => (
              <label key={app.id} className="graph-drawer-checkbox-row">
                <input
                  type="checkbox"
                  checked={selectedApplicationIds.includes(app.id)}
                  onChange={() => {
                    editedRef.current = true;
                    setSelectedApplicationIds((prev) => toggleSortedValue(prev, app.id));
                  }}
                />
                <span className="graph-filter-option-label" title={app.name ?? app.id}>
                  {app.name ?? app.id}
                </span>
              </label>
            ))
          )}
        </div>
      </div>
    );
  }

  function renderNodeAttributeDetail(dimension: GraphNodeFilterDto) {
    const catalog = nodeCatalogs[dimension.key] ?? [];
    const selected = selectedNodeValues[dimension.key] ?? [];
    const mode = dimensionMode(selected, catalog);
    const filteredValues = catalog.filter((value) =>
      matchesSearch(`${optionLabel(dimension, value)} ${value}`, valueQuery)
    );

    return (
      <div className="graph-filter-detail-panel">
        {catalog.length === 0 ? (
          <p className="graph-filter-hint">
            {isNodeRefDimension(dimension)
              ? 'No active catalogue value for this reference. Add values in the Data Model, then save.'
              : isEdgeDimension(dimension)
                ? 'No value recorded yet for this edge attribute. Values appear once DEPENDS_ON relationships carry it.'
                : 'No value recorded yet for this attribute. Values appear once applications carry it.'}
          </p>
        ) : (
          <>
            <div className="graph-filter-search">
              <input
                type="search"
                className="graph-filter-search-input"
                value={valueQuery}
                onChange={(e) => setValueQuery(e.target.value)}
                placeholder="Search values…"
                aria-label={`Search ${dimension.label} values`}
                onKeyDown={stopSearchSubmit}
              />
            </div>
            <div className="graph-drawer-region-checkboxes graph-filter-detail-list">
              <label className="graph-drawer-checkbox-row graph-filter-select-all-row">
                <input
                  ref={detailSelectAllRef}
                  type="checkbox"
                  checked={rootCheckboxState(mode) === 'checked'}
                  onChange={() => {
                    editedRef.current = true;
                    setSelectedNodeValues((prev) => ({
                      ...prev,
                      [dimension.key]: applyRootToggle(catalog, selected),
                    }));
                  }}
                />
                <span>Select all</span>
              </label>
              {filteredValues.length === 0 ? (
                <p className="graph-filter-hint graph-filter-search-empty" role="status">
                  No value matches “{valueQuery.trim()}”.
                </p>
              ) : (
                filteredValues.map((value) => (
                  <label key={value} className="graph-drawer-checkbox-row">
                    <input
                      type="checkbox"
                      checked={selected.includes(value)}
                      onChange={() => {
                        editedRef.current = true;
                        setSelectedNodeValues((prev) => ({
                          ...prev,
                          [dimension.key]: toggleSortedValue(prev[dimension.key] ?? [], value),
                        }));
                      }}
                    />
                    <span>{optionLabel(dimension, value)}</span>
                  </label>
                ))
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  function renderRootRow(options: {
    key: string;
    view: FilterView;
    label: string;
    plural: string;
    selected: string[];
    catalog: string[];
  }) {
    const mode = dimensionMode(options.selected, options.catalog);
    return (
      <div className="graph-filter-root-row" key={options.key}>
        <button
          type="button"
          className="graph-filter-root-row-main"
          onClick={() => openDetail(options.view)}
        >
          <span className="graph-filter-root-row-title">{options.label}</span>
          <span className={statusClass(mode)}>
            {dimensionStatusLabel(
              mode,
              options.selected.length,
              options.catalog.length,
              options.plural
            )}
          </span>
        </button>
        <button
          type="button"
          className="graph-filter-drill-btn"
          onClick={() => openDetail(options.view)}
          aria-label={`Choose ${options.plural}`}
        >
          Choose
        </button>
      </div>
    );
  }

  const headerTitle =
    view === 'root'
      ? 'Filters'
      : view === 'applications'
        ? 'Applications'
        : (detailDimension?.label ?? 'Filters');

  const isEmbedded = variant === 'embedded';
  const showHeader = !isEmbedded || view !== 'root';

  const flowChoices = useMemo(
    () =>
      edges.map((edge) => {
        const readApplicationName = (id: string) => applications.find((app) => app.id === id)?.name ?? id;
        const base = `${readApplicationName(edge.sourceId)} → ${readApplicationName(edge.targetId)}`;
        const data = edge.data?.trim();
        return { id: edge.id, label: data ? `${base} (${data})` : base };
      }),
    [edges, applications]
  );
  const searchHits = useMemo(
    () =>
      searchFilterHits({
        query: dimensionQuery,
        dimensions: nodeFilters,
        applications,
        edges: flowChoices,
        valueLabel: optionLabel,
      }),
    [dimensionQuery, nodeFilters, applications, flowChoices]
  );

  function chooseSearchHit(hit: FilterSearchHit) {
    if (hit.kind === 'filter' && hit.filterView) {
      setDimensionQuery('');
      openDetail(hit.filterView);
      return;
    }
    editedRef.current = true;
    if (hit.kind === 'app' && hit.applicationId) {
      setSelectedApplicationIds((prev) => toggleSortedValue(prev, hit.applicationId ?? ''));
      return;
    }
    if (hit.kind === 'attribute' && hit.dimensionKey && hit.value != null) {
      const key = hit.dimensionKey;
      const value = hit.value;
      setSelectedNodeValues((prev) => ({
        ...prev,
        [key]: toggleSortedValue(prev[key] ?? [], value),
      }));
      return;
    }
    if (hit.kind === 'edge' && hit.edgeId) checkFlow(hit.edgeId);
  }

  function checkFlow(edgeId: string) {
    const next = toggleSortedValue(selectedFlowIds, edgeId);
    setSelectedFlowIds(next);
    if (!next.includes(edgeId)) return;
    const endpointIds = edges
      .filter((edge) => next.includes(edge.id))
      .flatMap((edge) => [edge.sourceId, edge.targetId]);
    setSelectedApplicationIds((current) => keepApplicationsForCheckedFlows(current, appCatalog, endpointIds));
  }

  function isSearchHitChecked(hit: FilterSearchHit): boolean {
    if (hit.kind === 'app' && hit.applicationId) return selectedApplicationIds.includes(hit.applicationId);
    if (hit.kind === 'attribute' && hit.dimensionKey && hit.value != null) {
      return (selectedNodeValues[hit.dimensionKey] ?? []).includes(hit.value);
    }
    if (hit.kind === 'edge' && hit.edgeId) return selectedFlowIds.includes(hit.edgeId);
    return false;
  }

  return (
    <aside
      id="graph-filter-drawer"
      className={`graph-filter-drawer${isOpen ? ' is-open' : ''}${isEmbedded ? ' graph-filter-drawer--embedded' : ''}`}
      aria-label="Graph filters"
      aria-hidden={!isOpen}
    >
      {showHeader ? (
        <header className="graph-filter-drawer-header">
          {view !== 'root' ? (
            <button
              type="button"
              className="graph-filter-back-btn"
              onClick={() => {
                setValueQuery('');
                setView('root');
              }}
              aria-label="Back to filters"
            >
              ‹ Back
            </button>
          ) : isEmbedded ? null : (
            <p className="graph-drawer-eyebrow">Filters</p>
          )}
          <h2 className="graph-filter-view-title">{headerTitle}</h2>
          {!isEmbedded ? (
            <button
              type="button"
              className="graph-drawer-close"
              onClick={onClose}
              aria-label="Close filters"
            >
              <CloseIcon />
            </button>
          ) : null}
        </header>
      ) : null}

      <form className="graph-drawer-form graph-filter-form" onSubmit={onSubmit}>
        {view === 'root' ? renderRootActions() : renderDetailViewActions()}
        {view === 'root' ? (
          <div className="graph-filter-root-list" role="group" aria-label="Filter types">
            <p className="graph-filter-hint">
              Narrow the graph. Each dimension combines with AND (all conditions must match).
            </p>

            <div className="graph-filter-search">
              <input
                type="search"
                className="graph-filter-search-input"
                value={dimensionQuery}
                onChange={(e) => setDimensionQuery(e.target.value)}
                placeholder="Search filters…"
                aria-label="Search filters"
                aria-controls="graph-filter-search-hits"
                aria-expanded={searchHits.length > 0}
                onKeyDown={stopSearchSubmit}
              />
              {dimensionQuery.trim() ? (
                <ul id="graph-filter-search-hits" className="graph-filter-search-hits" role="listbox">
                  {searchHits.length === 0 ? (
                    <li className="graph-filter-hint">No match for “{dimensionQuery.trim()}”.</li>
                  ) : (
                    searchHits.map((hit) => (
                      <li key={hit.key}>
                        <button
                          type="button"
                          className="graph-filter-search-hit"
                          role="option"
                          aria-selected={hit.kind !== 'filter' && isSearchHitChecked(hit)}
                          onClick={() => chooseSearchHit(hit)}
                        >
                          {hit.kind === 'filter' ? null : (
                            <input type="checkbox" tabIndex={-1} readOnly checked={isSearchHitChecked(hit)} />
                          )}
                          <span className="graph-filter-search-hit-label">{hit.label}</span>
                          <span className="graph-filter-search-hit-kind">{hit.kind}</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
            </div>

            {renderRootRow({
              key: 'applications',
              view: 'applications',
              label: 'Application',
              plural: 'applications',
              selected: selectedApplicationIds,
              catalog: appCatalog,
            })}

            {nodeFilters.map((dimension) =>
              renderRootRow({
                key: dimension.key,
                view: nodeAttributeView(dimension.key),
                label: dimension.label,
                plural: 'values',
                selected: selectedNodeValues[dimension.key] ?? [],
                catalog: nodeCatalogs[dimension.key] ?? [],
              })
            )}

            {nodeFilters.length === 0 ? (
              <p className="graph-filter-hint" role="status">
                No filter dimensions configured. Add Data Model fields with target
                &quot;Application (node)&quot;, &quot;Application (reference)&quot;, or
                &quot;Connection (edge)&quot; to filter on them.
              </p>
            ) : null}

            {isGraphBlank ? (
              <p className="graph-filter-warning graph-filter-warning--hint" role="status">
                Nothing is checked on a filter, so the graph is empty.
              </p>
            ) : null}
          </div>
        ) : view === 'applications' ? (
          renderApplicationsDetail()
        ) : detailDimension ? (
          renderNodeAttributeDetail(detailDimension)
        ) : null}
      </form>
    </aside>
  );
}

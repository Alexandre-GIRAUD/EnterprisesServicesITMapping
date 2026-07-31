import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { ApplicationResponse, GraphFilters, GraphNodeFilterDto } from '@/types/api';
import {
  type FilterView,
  dimensionMode,
  dimensionStatusLabel,
  hasInvalidDimensionSelection,
  nodeAttributeKeyFromView,
  nodeAttributeView,
  rootCheckboxState,
  selectAllCatalog,
  toApiFilterList,
  toggleSortedValue,
} from './filterDimensionUtils';

export type { GraphFilters };

type FilterDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  variant?: 'overlay' | 'embedded';
  applications: ApplicationResponse[];
  /** Dimensions derived from the Data Model NODE + NODE_REF fields. */
  nodeFilters: GraphNodeFilterDto[];
  initialApplicationIds: string[];
  initialNodeAttributes: Record<string, string[]>;
  initialNodeRefs?: Record<string, string[]>;
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

function optionLabel(dimension: GraphNodeFilterDto, id: string): string {
  const fromOptions = dimension.options?.find((o) => o.id === id)?.name;
  return fromOptions && fromOptions.trim() ? fromOptions : id;
}

function initialForDimension(
  dimension: GraphNodeFilterDto,
  initialNodeAttributes: Record<string, string[]>,
  initialNodeRefs: Record<string, string[]>
): string[] {
  if (isNodeRefDimension(dimension)) {
    return initialNodeRefs[dimension.key] ?? [];
  }
  return initialNodeAttributes[dimension.key] ?? [];
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
  onApply,
  showPinView = false,
  pinViewDisabled = false,
  onPinView,
}: FilterDrawerProps) {
  const [view, setView] = useState<FilterView>('root');
  const [selectedApplicationIds, setSelectedApplicationIds] = useState(initialApplicationIds);
  const [selectedNodeValues, setSelectedNodeValues] = useState<Record<string, string[]>>({});
  const [detailError, setDetailError] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

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
  const applyBlocked = hasInvalidDimensionSelection([appMode, ...nodeModes]);

  const detailSelectAllRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setView('root');
    setDetailError(null);
    setApplyError(null);
    setSelectedApplicationIds(
      initialApplicationIds.length > 0 ? initialApplicationIds : selectAllCatalog(appCatalog)
    );
    setSelectedNodeValues(
      Object.fromEntries(
        nodeFilters.map((dimension) => {
          const initial = initialForDimension(dimension, initialNodeAttributes, initialNodeRefs);
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
    appCatalog,
    nodeFilters,
    nodeCatalogs,
  ]);

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
    setDetailError(null);
    setView(next);
  }

  function clearDetailDimension() {
    setDetailError(null);
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
    if (detailMode === 'none') {
      setDetailError('Select at least one, or tap Clear to include all.');
      return;
    }
    setDetailError(null);
    setView('root');
  }

  function filtersForApi(): Pick<GraphFilters, 'nodeAttributes' | 'nodeRefs'> {
    const nodeAttributes: Record<string, string[]> = {};
    const nodeRefs: Record<string, string[]> = {};
    for (const dimension of nodeFilters) {
      const selected = toApiFilterList(
        selectedNodeValues[dimension.key] ?? [],
        nodeCatalogs[dimension.key] ?? []
      );
      if (!selected || selected.length === 0) continue;
      if (isNodeRefDimension(dimension)) {
        nodeRefs[dimension.key] = selected;
      } else {
        nodeAttributes[dimension.key] = selected;
      }
    }
    return { nodeAttributes, nodeRefs };
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (applyBlocked) {
      setApplyError(
        'One or more dimensions have no items selected. The graph would be empty. Open each dimension and pick at least one item, or use Clear to include all.'
      );
      return;
    }
    setApplyError(null);
    const { nodeAttributes, nodeRefs } = filtersForApi();
    onApply({
      applicationIds: toApiFilterList(selectedApplicationIds, appCatalog) ?? [],
      nodeAttributes,
      nodeRefs,
    });
    onClose();
  }

  function onReset() {
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
    setDetailError(null);
    setApplyError(null);
    onApply({ applicationIds: [], nodeAttributes: {}, nodeRefs: {} });
  }

  function renderRootActions() {
    return (
      <div className="graph-filter-compact-actions">
        <button type="button" className="graph-filter-compact-btn" onClick={onReset}>
          Clear
        </button>
        <button
          type="submit"
          className="graph-filter-compact-btn graph-filter-compact-btn--primary"
          disabled={applyBlocked}
          aria-disabled={applyBlocked}
        >
          Apply
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
                ? 'Apply at least one filter before pinning a view'
                : 'Pin current filter set'
            }
          >
            Pin filters set
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
    return (
      <div className="graph-filter-detail-panel">
        {detailError ? (
          <p className="graph-filter-warning" role="alert">
            {detailError}
          </p>
        ) : null}
        <div className="graph-drawer-region-checkboxes graph-filter-detail-list">
          <label className="graph-drawer-checkbox-row graph-filter-select-all-row">
            <input
              ref={detailSelectAllRef}
              type="checkbox"
              checked={rootCheckboxState(appMode) === 'checked'}
              onChange={() =>
                setSelectedApplicationIds(applyRootToggle(appCatalog, selectedApplicationIds))
              }
            />
            <span>Select all</span>
          </label>
          {applications.map((app) => (
            <label key={app.id} className="graph-drawer-checkbox-row">
              <input
                type="checkbox"
                checked={selectedApplicationIds.includes(app.id)}
                onChange={() => {
                  setDetailError(null);
                  setSelectedApplicationIds((prev) => toggleSortedValue(prev, app.id));
                }}
              />
              <span>{app.name ?? app.id}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  function renderNodeAttributeDetail(dimension: GraphNodeFilterDto) {
    const catalog = nodeCatalogs[dimension.key] ?? [];
    const selected = selectedNodeValues[dimension.key] ?? [];
    const mode = dimensionMode(selected, catalog);

    return (
      <div className="graph-filter-detail-panel">
        {detailError ? (
          <p className="graph-filter-warning" role="alert">
            {detailError}
          </p>
        ) : null}
        {catalog.length === 0 ? (
          <p className="graph-filter-hint">
            {isNodeRefDimension(dimension)
              ? 'No active catalogue value for this reference. Add values in the Data Model, then save.'
              : 'No value recorded yet for this attribute. Values appear once applications carry it.'}
          </p>
        ) : (
          <div className="graph-drawer-region-checkboxes graph-filter-detail-list">
            <label className="graph-drawer-checkbox-row graph-filter-select-all-row">
              <input
                ref={detailSelectAllRef}
                type="checkbox"
                checked={rootCheckboxState(mode) === 'checked'}
                onChange={() =>
                  setSelectedNodeValues((prev) => ({
                    ...prev,
                    [dimension.key]: applyRootToggle(catalog, selected),
                  }))
                }
              />
              <span>Select all</span>
            </label>
            {catalog.map((value) => (
              <label key={value} className="graph-drawer-checkbox-row">
                <input
                  type="checkbox"
                  checked={selected.includes(value)}
                  onChange={() => {
                    setDetailError(null);
                    setSelectedNodeValues((prev) => ({
                      ...prev,
                      [dimension.key]: toggleSortedValue(prev[dimension.key] ?? [], value),
                    }));
                  }}
                />
                <span>{optionLabel(dimension, value)}</span>
              </label>
            ))}
          </div>
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
                setDetailError(null);
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
              x
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
                No application attributes configured. Add Data Model fields with target
                &quot;Application (node)&quot; or &quot;Application (reference)&quot; to filter on
                them.
              </p>
            ) : null}

            {applyError ? (
              <p className="graph-filter-warning" role="alert">
                {applyError}
              </p>
            ) : applyBlocked ? (
              <p className="graph-filter-warning graph-filter-warning--hint" role="status">
                Fix dimensions marked &quot;None selected&quot; before applying.
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

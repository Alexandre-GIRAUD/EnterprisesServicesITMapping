import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ApplicationResponse,
  BusinessUnitListItem,
  GraphFilters,
  RegionSummary,
} from '@/types/api';
import {
  type FilterView,
  dimensionMode,
  dimensionStatusLabel,
  hasInvalidDimensionSelection,
  rootCheckboxState,
  selectAllCatalog,
  toApiFilterList,
  toggleSortedValue,
  yearFilterLabel,
} from './filterDimensionUtils';

export type { GraphFilters };

type FilterDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  variant?: 'overlay' | 'embedded';
  applications: ApplicationResponse[];
  businessUnits: BusinessUnitListItem[];
  regions: RegionSummary[];
  initialYear: number | null;
  initialApplicationIds: string[];
  initialBusinessUnitIds: string[];
  initialRegionCodes: string[];
  onApply: (filters: GraphFilters) => void;
};

type DimensionKey = 'applications' | 'businessUnits' | 'regions';

const DIMENSION_META: Record<
  DimensionKey,
  { view: FilterView; rootLabel: string; detailTitle: string; plural: string }
> = {
  applications: {
    view: 'applications',
    rootLabel: 'Application',
    detailTitle: 'Applications',
    plural: 'applications',
  },
  businessUnits: {
    view: 'businessUnits',
    rootLabel: 'Business unit',
    detailTitle: 'Business units',
    plural: 'business units',
  },
  regions: {
    view: 'regions',
    rootLabel: 'Region',
    detailTitle: 'Regions',
    plural: 'regions',
  },
};

function applyRootToggle(catalog: string[], selected: string[]): string[] {
  const mode = dimensionMode(selected, catalog);
  if (mode === 'none') return selectAllCatalog(catalog);
  return [];
}

function statusClass(mode: ReturnType<typeof dimensionMode>): string {
  if (mode === 'some') return 'graph-filter-status is-active';
  if (mode === 'none') return 'graph-filter-status is-invalid';
  return 'graph-filter-status';
}

export function FilterDrawer({
  isOpen,
  onClose,
  variant = 'overlay',
  applications,
  businessUnits,
  regions,
  initialYear,
  initialApplicationIds,
  initialBusinessUnitIds,
  initialRegionCodes,
  onApply,
}: FilterDrawerProps) {
  const [view, setView] = useState<FilterView>('root');
  const [year, setYear] = useState<number | null>(initialYear);
  const [selectedApplicationIds, setSelectedApplicationIds] = useState(initialApplicationIds);
  const [selectedBusinessUnitIds, setSelectedBusinessUnitIds] = useState(initialBusinessUnitIds);
  const [selectedRegionCodes, setSelectedRegionCodes] = useState(initialRegionCodes);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const appCatalog = useMemo(
    () =>
      [...applications]
        .sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id, undefined, { sensitivity: 'base' }))
        .map((a) => a.id),
    [applications]
  );
  const buCatalog = useMemo(
    () =>
      [...businessUnits]
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
        .map((bu) => bu.id),
    [businessUnits]
  );
  const regionCatalog = useMemo(
    () =>
      [...regions]
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { sensitivity: 'base' }))
        .map((r) => r.code),
    [regions]
  );

  const appMode = dimensionMode(selectedApplicationIds, appCatalog);
  const buMode = dimensionMode(selectedBusinessUnitIds, buCatalog);
  const regionMode = dimensionMode(selectedRegionCodes, regionCatalog);
  const dimensionModes = [appMode, buMode, regionMode];
  const applyBlocked = hasInvalidDimensionSelection(dimensionModes);

  const detailSelectAllRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setView('root');
      setYear(initialYear);
      setDetailError(null);
      setApplyError(null);
      setSelectedApplicationIds(
        initialApplicationIds.length > 0 ? initialApplicationIds : selectAllCatalog(appCatalog)
      );
      setSelectedBusinessUnitIds(
        initialBusinessUnitIds.length > 0 ? initialBusinessUnitIds : selectAllCatalog(buCatalog)
      );
      setSelectedRegionCodes(
        initialRegionCodes.length > 0 ? initialRegionCodes : selectAllCatalog(regionCatalog)
      );
    }
  }, [
    isOpen,
    initialYear,
    initialApplicationIds,
    initialBusinessUnitIds,
    initialRegionCodes,
    appCatalog,
    buCatalog,
    regionCatalog,
  ]);

  const detailMode =
    view === 'applications' ? appMode : view === 'businessUnits' ? buMode : view === 'regions' ? regionMode : 'none';

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

  function clearDetailDimension(key: DimensionKey) {
    setDetailError(null);
    if (key === 'applications') setSelectedApplicationIds(selectAllCatalog(appCatalog));
    if (key === 'businessUnits') setSelectedBusinessUnitIds(selectAllCatalog(buCatalog));
    if (key === 'regions') setSelectedRegionCodes(selectAllCatalog(regionCatalog));
  }

  function confirmDetailDimension(key: DimensionKey) {
    const mode =
      key === 'applications' ? appMode : key === 'businessUnits' ? buMode : regionMode;
    if (mode === 'none') {
      setDetailError('Select at least one, or tap Clear to include all.');
      return;
    }
    setDetailError(null);
    setView('root');
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
    onApply({
      year,
      applicationIds: toApiFilterList(selectedApplicationIds, appCatalog) ?? [],
      businessUnitIds: toApiFilterList(selectedBusinessUnitIds, buCatalog) ?? [],
      regionCodes: toApiFilterList(selectedRegionCodes, regionCatalog) ?? [],
    });
    onClose();
  }

  function onReset() {
    setYear(null);
    setSelectedApplicationIds(selectAllCatalog(appCatalog));
    setSelectedBusinessUnitIds(selectAllCatalog(buCatalog));
    setSelectedRegionCodes(selectAllCatalog(regionCatalog));
    setView('root');
    setDetailError(null);
    setApplyError(null);
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
      </div>
    );
  }

  function renderDetailViewActions() {
    if (view === 'year') {
      const doneLabel = year != null ? `Done (${year})` : 'Done';
      return (
        <div className="graph-filter-compact-actions">
          <button
            type="button"
            className="graph-filter-compact-btn"
            onClick={() => {
              setApplyError(null);
              setYear(null);
            }}
          >
            Clear
          </button>
          <button
            type="button"
            className="graph-filter-compact-btn graph-filter-compact-btn--primary"
            onClick={() => setView('root')}
          >
            {doneLabel}
          </button>
        </div>
      );
    }

    if (view === 'applications' || view === 'businessUnits' || view === 'regions') {
      const key = view;
      const mode =
        key === 'applications' ? appMode : key === 'businessUnits' ? buMode : regionMode;
      const selectedCount =
        key === 'applications'
          ? selectedApplicationIds.length
          : key === 'businessUnits'
            ? selectedBusinessUnitIds.length
            : selectedRegionCodes.length;
      const doneLabel =
        mode === 'all' ? 'Done' : mode === 'some' ? `Done (${selectedCount})` : 'Done';

      return (
        <div className="graph-filter-compact-actions">
          <button
            type="button"
            className="graph-filter-compact-btn"
            onClick={() => clearDetailDimension(key)}
          >
            Clear
          </button>
          <button
            type="button"
            className="graph-filter-compact-btn graph-filter-compact-btn--primary"
            onClick={() => confirmDetailDimension(key)}
          >
            {doneLabel}
          </button>
        </div>
      );
    }

    return null;
  }

  function renderDetail() {
    if (view === 'applications') {
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

    if (view === 'businessUnits') {
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
                checked={rootCheckboxState(buMode) === 'checked'}
                onChange={() =>
                  setSelectedBusinessUnitIds(applyRootToggle(buCatalog, selectedBusinessUnitIds))
                }
              />
              <span>Select all</span>
            </label>
            {businessUnits.map((bu) => (
              <label key={bu.id} className="graph-drawer-checkbox-row">
                <input
                  type="checkbox"
                  checked={selectedBusinessUnitIds.includes(bu.id)}
                  onChange={() => {
                    setDetailError(null);
                    setSelectedBusinessUnitIds((prev) => toggleSortedValue(prev, bu.id));
                  }}
                />
                <span>{bu.name}</span>
              </label>
            ))}
          </div>
        </div>
      );
    }

    if (view === 'regions') {
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
                checked={rootCheckboxState(regionMode) === 'checked'}
                onChange={() =>
                  setSelectedRegionCodes(applyRootToggle(regionCatalog, selectedRegionCodes))
                }
              />
              <span>Select all</span>
            </label>
            {regions.map((r) => (
              <label key={r.id} className="graph-drawer-checkbox-row">
                <input
                  type="checkbox"
                  checked={selectedRegionCodes.includes(r.code)}
                  onChange={() => {
                    setDetailError(null);
                    setSelectedRegionCodes((prev) => toggleSortedValue(prev, r.code));
                  }}
                />
                <span>
                  {r.code}
                  {r.name ? ` — ${r.name}` : ''}
                </span>
              </label>
            ))}
          </div>
        </div>
      );
    }

    return null;
  }

  function renderYearDetail() {
    return (
      <div className="graph-filter-detail-panel">
        <div className="graph-filter-year-detail">
          <label className="graph-drawer-field">
            <span className="graph-drawer-field-label">Year</span>
            <input
              className="graph-drawer-input"
              type="number"
              inputMode="numeric"
              placeholder="All years"
              value={year ?? ''}
              min={1970}
              max={2100}
              onChange={(e) => {
                setApplyError(null);
                const v = e.target.value.trim();
                setYear(v === '' ? null : Number(v));
              }}
            />
            <span className={`graph-filter-status${year != null ? ' is-active' : ''}`}>
              {yearFilterLabel(year)}
            </span>
          </label>
        </div>
      </div>
    );
  }

  function renderYearRootRow() {
    return (
      <div className="graph-filter-root-row">
        <button
          type="button"
          className="graph-filter-root-row-main"
          onClick={() => openDetail('year')}
        >
          <span className="graph-filter-root-row-title">Year</span>
          <span className={`graph-filter-status${year != null ? ' is-active' : ''}`}>
            {yearFilterLabel(year)}
          </span>
        </button>
        <button
          type="button"
          className="graph-filter-drill-btn"
          onClick={() => openDetail('year')}
          aria-label="Choose year"
        >
          Choose
        </button>
      </div>
    );
  }

  function renderRootDimensionRow(key: DimensionKey) {
    const meta = DIMENSION_META[key];
    const mode = key === 'applications' ? appMode : key === 'businessUnits' ? buMode : regionMode;
    const catalog =
      key === 'applications' ? appCatalog : key === 'businessUnits' ? buCatalog : regionCatalog;
    const selected =
      key === 'applications'
        ? selectedApplicationIds
        : key === 'businessUnits'
          ? selectedBusinessUnitIds
          : selectedRegionCodes;

    return (
      <div className="graph-filter-root-row" key={key}>
        <button
          type="button"
          className="graph-filter-root-row-main"
          onClick={() => openDetail(meta.view)}
        >
          <span className="graph-filter-root-row-title">{meta.rootLabel}</span>
          <span className={statusClass(mode)}>
            {dimensionStatusLabel(mode, selected.length, catalog.length, meta.plural)}
          </span>
        </button>
        <button
          type="button"
          className="graph-filter-drill-btn"
          onClick={() => openDetail(meta.view)}
          aria-label={`Choose ${meta.plural}`}
        >
          Choose
        </button>
      </div>
    );
  }

  const headerTitle =
    view === 'root'
      ? 'Filters'
      : view === 'year'
        ? 'Year'
        : DIMENSION_META[view as DimensionKey]?.detailTitle ?? 'Filters';

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

            {renderYearRootRow()}
            {renderRootDimensionRow('applications')}
            {renderRootDimensionRow('businessUnits')}
            {renderRootDimensionRow('regions')}

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
        ) : view === 'year' ? (
          renderYearDetail()
        ) : (
          renderDetail()
        )}
      </form>
    </aside>
  );
}

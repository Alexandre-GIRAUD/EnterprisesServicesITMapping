import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { ApplicationResponse, BusinessUnitListItem, RegionSummary } from '@/types/api';
import {
  type FilterView,
  dimensionMode,
  rootCheckboxState,
  selectAllCatalog,
  toApiFilterList,
  toggleSortedValue,
} from './filterDimensionUtils';

export type GraphFilters = {
  year: number | null;
  applicationIds: string[];
  businessUnitIds: string[];
  regionCodes: string[];
};

type FilterDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
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
  { view: FilterView; rootLabel: string; detailTitle: string }
> = {
  applications: {
    view: 'applications',
    rootLabel: 'Application',
    detailTitle: 'Application',
  },
  businessUnits: {
    view: 'businessUnits',
    rootLabel: 'Business unit',
    detailTitle: 'Business unit',
  },
  regions: {
    view: 'regions',
    rootLabel: 'Region',
    detailTitle: 'Region',
  },
};

function applyRootToggle(catalog: string[], selected: string[]): string[] {
  const mode = dimensionMode(selected, catalog);
  if (mode === 'none') return selectAllCatalog(catalog);
  return [];
}

export function FilterDrawer({
  isOpen,
  onClose,
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

  const detailSelectAllRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setView('root');
      setYear(initialYear);
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

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
  }

  function renderDetail() {
    if (view === 'applications') {
      return (
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
                onChange={() =>
                  setSelectedApplicationIds((prev) => toggleSortedValue(prev, app.id))
                }
              />
              <span>{app.name ?? app.id}</span>
            </label>
          ))}
        </div>
      );
    }

    if (view === 'businessUnits') {
      return (
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
                onChange={() =>
                  setSelectedBusinessUnitIds((prev) => toggleSortedValue(prev, bu.id))
                }
              />
              <span>{bu.name}</span>
            </label>
          ))}
        </div>
      );
    }

    if (view === 'regions') {
      return (
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
                onChange={() =>
                  setSelectedRegionCodes((prev) => toggleSortedValue(prev, r.code))
                }
              />
              <span>
                {r.code}
                {r.name ? ` — ${r.name}` : ''}
              </span>
            </label>
          ))}
        </div>
      );
    }

    return null;
  }

  const headerTitle =
    view === 'root' ? 'Filters' : DIMENSION_META[view as DimensionKey]?.detailTitle ?? 'Filters';

  return (
    <aside
      id="graph-filter-drawer"
      className={`graph-filter-drawer${isOpen ? ' is-open' : ''}`}
      aria-label="Graph filters"
      aria-hidden={!isOpen}
    >
      <header className="graph-filter-drawer-header">
        {view !== 'root' ? (
          <button
            type="button"
            className="graph-filter-back-btn"
            onClick={() => setView('root')}
            aria-label="Back to filters"
          >
            ‹ Back
          </button>
        ) : (
          <p className="graph-drawer-eyebrow">Filters</p>
        )}
        <h2 className="graph-filter-view-title">{headerTitle}</h2>
        <button
          type="button"
          className="graph-drawer-close"
          onClick={onClose}
          aria-label="Close filters"
        >
          x
        </button>
      </header>

      <form className="graph-drawer-form graph-filter-form" onSubmit={onSubmit}>
        {view === 'root' ? (
          <div className="graph-filter-root-list" role="group" aria-label="Filter types">
            <label className="graph-drawer-field graph-filter-year-field">
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
                  const v = e.target.value.trim();
                  setYear(v === '' ? null : Number(v));
                }}
              />
            </label>
            <div className="graph-filter-root-row">
              <label className="graph-filter-root-label">
                <input
                  type="checkbox"
                  ref={(el) => {
                    if (el) el.indeterminate = appMode === 'some';
                  }}
                  checked={rootCheckboxState(appMode) === 'checked'}
                  onChange={() =>
                    setSelectedApplicationIds(
                      applyRootToggle(appCatalog, selectedApplicationIds)
                    )
                  }
                />
                <span>{DIMENSION_META.applications.rootLabel}</span>
                {appMode === 'all' && <span className="graph-filter-all-badge">all</span>}
              </label>
              <button
                type="button"
                className="graph-filter-drill-btn"
                onClick={() => setView('applications')}
                aria-label="Open Application filter"
              >
                ›
              </button>
            </div>
            <div className="graph-filter-root-row">
              <label className="graph-filter-root-label">
                <input
                  type="checkbox"
                  ref={(el) => {
                    if (el) el.indeterminate = buMode === 'some';
                  }}
                  checked={rootCheckboxState(buMode) === 'checked'}
                  onChange={() =>
                    setSelectedBusinessUnitIds(
                      applyRootToggle(buCatalog, selectedBusinessUnitIds)
                    )
                  }
                />
                <span>{DIMENSION_META.businessUnits.rootLabel}</span>
                {buMode === 'all' && <span className="graph-filter-all-badge">all</span>}
              </label>
              <button
                type="button"
                className="graph-filter-drill-btn"
                onClick={() => setView('businessUnits')}
                aria-label="Open Business unit filter"
              >
                ›
              </button>
            </div>
            <div className="graph-filter-root-row">
              <label className="graph-filter-root-label">
                <input
                  type="checkbox"
                  ref={(el) => {
                    if (el) el.indeterminate = regionMode === 'some';
                  }}
                  checked={rootCheckboxState(regionMode) === 'checked'}
                  onChange={() =>
                    setSelectedRegionCodes(applyRootToggle(regionCatalog, selectedRegionCodes))
                  }
                />
                <span>{DIMENSION_META.regions.rootLabel}</span>
                {regionMode === 'all' && <span className="graph-filter-all-badge">all</span>}
              </label>
              <button
                type="button"
                className="graph-filter-drill-btn"
                onClick={() => setView('regions')}
                aria-label="Open Region filter"
              >
                ›
              </button>
            </div>
          </div>
        ) : (
          renderDetail()
        )}

        <div className="graph-drawer-form-actions">
          <button
            type="submit"
            className="graph-drawer-action graph-drawer-action-primary"
          >
            <span className="graph-drawer-action-title">Apply</span>
          </button>
          <button type="button" className="graph-drawer-action" onClick={onReset}>
            <span className="graph-drawer-action-title">Reset</span>
          </button>
        </div>
      </form>
    </aside>
  );
}

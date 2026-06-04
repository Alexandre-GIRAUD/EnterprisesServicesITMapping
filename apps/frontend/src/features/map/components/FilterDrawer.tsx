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
  initialApplicationIds,
  initialBusinessUnitIds,
  initialRegionCodes,
  onApply,
}: FilterDrawerProps) {
  const [view, setView] = useState<FilterView>('root');
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

  const appRootRef = useRef<HTMLInputElement | null>(null);
  const buRootRef = useRef<HTMLInputElement | null>(null);
  const regionRootRef = useRef<HTMLInputElement | null>(null);
  const detailSelectAllRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setView('root');
      setSelectedApplicationIds(initialApplicationIds);
      setSelectedBusinessUnitIds(initialBusinessUnitIds);
      setSelectedRegionCodes(initialRegionCodes);
    }
  }, [isOpen, initialApplicationIds, initialBusinessUnitIds, initialRegionCodes]);

  useEffect(() => {
    const el = appRootRef.current;
    if (el) el.indeterminate = rootCheckboxState(appMode) === 'indeterminate';
  }, [appMode]);

  useEffect(() => {
    const el = buRootRef.current;
    if (el) el.indeterminate = rootCheckboxState(buMode) === 'indeterminate';
  }, [buMode]);

  useEffect(() => {
    const el = regionRootRef.current;
    if (el) el.indeterminate = rootCheckboxState(regionMode) === 'indeterminate';
  }, [regionMode]);

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
      applicationIds: toApiFilterList(selectedApplicationIds, appCatalog) ?? [],
      businessUnitIds: toApiFilterList(selectedBusinessUnitIds, buCatalog) ?? [],
      regionCodes: toApiFilterList(selectedRegionCodes, regionCatalog) ?? [],
    });
    onClose();
  }

  function onReset() {
    setSelectedApplicationIds([]);
    setSelectedBusinessUnitIds([]);
    setSelectedRegionCodes([]);
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
            <span>Tout sélectionner</span>
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
              <span>
                {app.name ?? app.id}
                <span className="graph-filter-item-id">{app.id}</span>
              </span>
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
            <span>Tout sélectionner</span>
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
            <span>Tout sélectionner</span>
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
    view === 'root' ? 'Filtres' : DIMENSION_META[view as DimensionKey]?.detailTitle ?? 'Filtres';

  return (
    <aside
      id="graph-filter-drawer"
      className={`graph-filter-drawer${isOpen ? ' is-open' : ''}`}
      aria-label="Filtres du graphe"
      aria-hidden={!isOpen}
    >
      <header className="graph-filter-drawer-header">
        {view !== 'root' ? (
          <button
            type="button"
            className="graph-filter-back-btn"
            onClick={() => setView('root')}
            aria-label="Retour aux filtres"
          >
            ‹ Retour
          </button>
        ) : (
          <p className="graph-drawer-eyebrow">Filtres</p>
        )}
        <h2 className="graph-filter-view-title">{headerTitle}</h2>
        <button
          type="button"
          className="graph-drawer-close"
          onClick={onClose}
          aria-label="Fermer les filtres"
        >
          x
        </button>
      </header>

      <form className="graph-drawer-form graph-filter-form" onSubmit={onSubmit}>
        {view === 'root' ? (
          <div className="graph-filter-root-list" role="group" aria-label="Types de filtres">
            <div className="graph-filter-root-row">
              <label className="graph-filter-root-label">
                <input
                  ref={appRootRef}
                  type="checkbox"
                  checked={rootCheckboxState(appMode) === 'checked'}
                  onChange={() =>
                    setSelectedApplicationIds(
                      applyRootToggle(appCatalog, selectedApplicationIds)
                    )
                  }
                />
                <span>{DIMENSION_META.applications.rootLabel}</span>
              </label>
              <button
                type="button"
                className="graph-filter-drill-btn"
                onClick={() => setView('applications')}
                aria-label="Ouvrir le filtre Application"
              >
                ›
              </button>
            </div>
            <div className="graph-filter-root-row">
              <label className="graph-filter-root-label">
                <input
                  ref={buRootRef}
                  type="checkbox"
                  checked={rootCheckboxState(buMode) === 'checked'}
                  onChange={() =>
                    setSelectedBusinessUnitIds(
                      applyRootToggle(buCatalog, selectedBusinessUnitIds)
                    )
                  }
                />
                <span>{DIMENSION_META.businessUnits.rootLabel}</span>
              </label>
              <button
                type="button"
                className="graph-filter-drill-btn"
                onClick={() => setView('businessUnits')}
                aria-label="Ouvrir le filtre Business unit"
              >
                ›
              </button>
            </div>
            <div className="graph-filter-root-row">
              <label className="graph-filter-root-label">
                <input
                  ref={regionRootRef}
                  type="checkbox"
                  checked={rootCheckboxState(regionMode) === 'checked'}
                  onChange={() =>
                    setSelectedRegionCodes(applyRootToggle(regionCatalog, selectedRegionCodes))
                  }
                />
                <span>{DIMENSION_META.regions.rootLabel}</span>
              </label>
              <button
                type="button"
                className="graph-filter-drill-btn"
                onClick={() => setView('regions')}
                aria-label="Ouvrir le filtre Region"
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
            <span className="graph-drawer-action-title">Rechercher</span>
          </button>
          <button type="button" className="graph-drawer-action" onClick={onReset}>
            <span className="graph-drawer-action-title">Réinitialiser</span>
          </button>
        </div>
      </form>
    </aside>
  );
}

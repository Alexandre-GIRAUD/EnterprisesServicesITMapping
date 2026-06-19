import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { GraphMode } from '../components/GraphModeTabs';
import type { GraphSnapshotFilters } from '@/types/api';

type UseGraphFiltersParams = {
  graphModeRef: MutableRefObject<GraphMode>;
  setGraphMode: Dispatch<SetStateAction<GraphMode>>;
  setSandboxDirty: Dispatch<SetStateAction<boolean>>;
  setIsDrawerOpen: Dispatch<SetStateAction<boolean>>;
};

/**
 * Owns the graph filter state (year + dimension id lists) and derived values.
 * `applyGraphFilters` also leaves any transient mode (sandbox / views) so that
 * applying a saved view always lands the user back on the normal graph.
 */
export function useGraphFilters({
  graphModeRef,
  setGraphMode,
  setSandboxDirty,
  setIsDrawerOpen,
}: UseGraphFiltersParams) {
  const [year, setYear] = useState<number | null>(null);
  const [applicationIds, setApplicationIds] = useState<string[]>([]);
  const [businessUnitIds, setBusinessUnitIds] = useState<string[]>([]);
  const [regionCodes, setRegionCodes] = useState<string[]>([]);

  const filtersActive =
    year != null ||
    applicationIds.length > 0 ||
    businessUnitIds.length > 0 ||
    regionCodes.length > 0;

  const applyGraphFilters = useCallback(
    (filters: GraphSnapshotFilters) => {
      if (graphModeRef.current === 'sandbox' || graphModeRef.current === 'views') {
        setGraphMode('normal');
        setSandboxDirty(false);
        setIsDrawerOpen(false);
      }
      setYear(filters.year);
      setApplicationIds(filters.applicationIds);
      setBusinessUnitIds(filters.businessUnitIds);
      setRegionCodes(filters.regionCodes);
    },
    [graphModeRef, setGraphMode, setSandboxDirty, setIsDrawerOpen]
  );

  const currentGraphFilters = useMemo<GraphSnapshotFilters>(
    () => ({ year, applicationIds, businessUnitIds, regionCodes }),
    [year, applicationIds, businessUnitIds, regionCodes]
  );

  return {
    year,
    setYear,
    applicationIds,
    setApplicationIds,
    businessUnitIds,
    setBusinessUnitIds,
    regionCodes,
    setRegionCodes,
    filtersActive,
    applyGraphFilters,
    currentGraphFilters,
  };
}

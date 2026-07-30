import { useCallback, useMemo, useState } from 'react';
import type { GraphMode } from '../components/GraphModeTabs';
import type { GraphSnapshotFilters } from '@/types/api';
import type { MutableRefObject, Dispatch, SetStateAction } from 'react';

type UseGraphFiltersParams = {
  graphModeRef: MutableRefObject<GraphMode>;
  setGraphMode: Dispatch<SetStateAction<GraphMode>>;
  setSandboxDirty: Dispatch<SetStateAction<boolean>>;
  setIsDrawerOpen: Dispatch<SetStateAction<boolean>>;
};

/**
 * Active graph filter set (application ids + NODE attrs + NODE_REF catalogue ids).
 * `applyGraphFilters` also leaves any transient mode (sandbox / views) so that applying a saved
 * snapshot returns to the live filtered graph.
 */
export function useGraphFilters({
  graphModeRef,
  setGraphMode,
  setSandboxDirty,
  setIsDrawerOpen,
}: UseGraphFiltersParams) {
  const [applicationIds, setApplicationIds] = useState<string[]>([]);
  const [nodeAttributes, setNodeAttributes] = useState<Record<string, string[]>>({});
  const [nodeRefs, setNodeRefs] = useState<Record<string, string[]>>({});

  const filtersActive =
    applicationIds.length > 0 ||
    Object.keys(nodeAttributes).length > 0 ||
    Object.keys(nodeRefs).length > 0;

  const applyGraphFilters = useCallback(
    (filters: GraphSnapshotFilters) => {
      if (graphModeRef.current === 'sandbox' || graphModeRef.current === 'views') {
        setGraphMode('normal');
        setSandboxDirty(false);
        setIsDrawerOpen(false);
      }
      setApplicationIds(filters.applicationIds ?? []);
      setNodeAttributes(filters.nodeAttributes ?? {});
      setNodeRefs(filters.nodeRefs ?? {});
    },
    [graphModeRef, setGraphMode, setSandboxDirty, setIsDrawerOpen]
  );

  const currentGraphFilters = useMemo<GraphSnapshotFilters>(
    () => ({ applicationIds, nodeAttributes, nodeRefs }),
    [applicationIds, nodeAttributes, nodeRefs]
  );

  return {
    applicationIds,
    setApplicationIds,
    nodeAttributes,
    setNodeAttributes,
    nodeRefs,
    setNodeRefs,
    filtersActive,
    applyGraphFilters,
    currentGraphFilters,
  };
}

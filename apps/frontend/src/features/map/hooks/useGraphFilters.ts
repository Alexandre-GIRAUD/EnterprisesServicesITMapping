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
 * Active graph filter set (application ids + NODE attrs + NODE_REF catalogue ids + EDGE attrs).
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
  const [edgeAttributes, setEdgeAttributes] = useState<Record<string, string[]>>({});
  const [edgeIds, setEdgeIds] = useState<string[]>([]);
  const [matchNothing, setMatchNothing] = useState(false);
  const [blankedDimensions, setBlankedDimensions] = useState<string[]>([]);

  const filtersActive =
    matchNothing ||
    edgeIds.length > 0 ||
    applicationIds.length > 0 ||
    Object.keys(nodeAttributes).length > 0 ||
    Object.keys(nodeRefs).length > 0 ||
    Object.keys(edgeAttributes).length > 0;

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
      setEdgeAttributes(filters.edgeAttributes ?? {});
      setEdgeIds([]);
      setMatchNothing(false);
      setBlankedDimensions([]);
    },
    [graphModeRef, setGraphMode, setSandboxDirty, setIsDrawerOpen]
  );

  const currentGraphFilters = useMemo<GraphSnapshotFilters>(
    () => ({ applicationIds, nodeAttributes, nodeRefs, edgeAttributes }),
    [applicationIds, nodeAttributes, nodeRefs, edgeAttributes]
  );

  return {
    applicationIds,
    setApplicationIds,
    nodeAttributes,
    setNodeAttributes,
    nodeRefs,
    setNodeRefs,
    edgeAttributes,
    setEdgeAttributes,
    edgeIds,
    setEdgeIds,
    matchNothing,
    setMatchNothing,
    blankedDimensions,
    setBlankedDimensions,
    filtersActive,
    applyGraphFilters,
    currentGraphFilters,
  };
}

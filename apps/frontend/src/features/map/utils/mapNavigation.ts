import { useNavigate } from 'react-router-dom';
import type { GraphMode } from '@/features/map/components/GraphModeTabs';
import type { GraphSnapshotFilters } from '@/types/api';

export type MapLocationState = {
  applySnapshot?: GraphSnapshotFilters;
  /** Switch the map graph tab when landing on /map (e.g. header Self Service link). */
  graphMode?: GraphMode;
};

export function navigateToMapWithSnapshot(
  navigate: ReturnType<typeof useNavigate>,
  filters: GraphSnapshotFilters
) {
  navigate('/map', { state: { applySnapshot: filters } satisfies MapLocationState });
}

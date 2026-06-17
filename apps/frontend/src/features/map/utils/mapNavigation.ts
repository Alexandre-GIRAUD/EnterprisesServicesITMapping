import { useNavigate } from 'react-router-dom';
import type { GraphSnapshotFilters } from '@/types/api';

export type MapLocationState = {
  applySnapshot?: GraphSnapshotFilters;
};

export function navigateToMapWithSnapshot(
  navigate: ReturnType<typeof useNavigate>,
  filters: GraphSnapshotFilters
) {
  navigate('/map', { state: { applySnapshot: filters } satisfies MapLocationState });
}

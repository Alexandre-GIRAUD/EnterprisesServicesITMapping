import type { NavigateFunction } from 'react-router-dom';
import type { GraphMode } from '@/features/map/components/GraphModeTabs';
import type { SideMenuTool } from '@/features/map/components/SelfServiceToolBar';
import type { GraphSnapshotFilters } from '@/types/api';

export type MapLocationState = {
  applySnapshot?: GraphSnapshotFilters;
  /** Switch the map graph tab when landing on /map (e.g. header Cartography link). */
  graphMode?: GraphMode;
  /** Open a side-menu tool when landing on /map (Production). */
  sideMenuTool?: SideMenuTool;
  /** Open the in-map module drill-down for this application id. */
  openModuleGraphId?: string;
  openModuleGraphLabel?: string;
};

export function moduleGraphMapState(
  applicationId: string,
  label?: string | null
): MapLocationState {
  const id = applicationId.trim();
  const state: MapLocationState = { openModuleGraphId: id };
  const name = label?.trim();
  if (name) {
    state.openModuleGraphLabel = name;
  }
  return state;
}

/** Navigate to Cartography map and open the module graph for one application. */
export function navigateToModuleGraph(
  navigate: NavigateFunction,
  applicationId: string,
  label?: string | null
): void {
  navigate('/map', { state: moduleGraphMapState(applicationId, label) });
}

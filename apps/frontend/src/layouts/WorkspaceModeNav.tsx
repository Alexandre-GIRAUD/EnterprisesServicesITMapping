import type { GraphMode } from '@/features/map/components/GraphModeTabs';
import { primaryWorkspaceMode } from '@/features/map/utils/workspaceViews';

const WORKSPACE_MODES: { mode: GraphMode; label: string; tabId: string; accent: string }[] = [
  { mode: 'normal', label: 'Production', tabId: 'graph-mode-tab-normal', accent: 'explorer' },
  { mode: 'sandbox', label: 'Sandbox', tabId: 'graph-mode-tab-sandbox', accent: 'sandbox' },
  { mode: 'views', label: 'My views', tabId: 'graph-mode-tab-views', accent: 'views' },
];

type WorkspaceModeNavProps = {
  mode: GraphMode | null;
  sandboxDirty: boolean;
  onModeChange: (mode: GraphMode) => void;
};

export function WorkspaceModeNav({ mode, sandboxDirty, onModeChange }: WorkspaceModeNavProps) {
  const primaryMode = mode == null ? null : primaryWorkspaceMode(mode);
  return (
    <div className="layout-mode-list" role="tablist" aria-label="Workspace views">
      {WORKSPACE_MODES.map((view) => {
        const isActive = mode === view.mode;
        const isPrimary = primaryMode === view.mode;
        return (
          <button
            key={view.mode}
            type="button"
            role="tab"
            id={view.tabId}
            className={`layout-mode-item layout-mode-item--${view.accent}${isPrimary ? ' is-primary' : ''}`}
            aria-selected={isActive}
            onClick={() => {
              if (!isActive) onModeChange(view.mode);
            }}
          >
            <span className="layout-mode-item-label">{view.label}</span>
            {view.mode === 'sandbox' && sandboxDirty && isActive ? (
              <span className="graph-mode-tab__draft" aria-label="Unsaved draft" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

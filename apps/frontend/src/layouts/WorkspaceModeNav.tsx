import type { GraphMode } from '@/features/map/components/GraphModeTabs';
import { SidebarSubItem } from './SidebarSubItem';

const WORKSPACE_MODES: { mode: GraphMode; label: string; tabId: string }[] = [
  { mode: 'normal', label: 'Production', tabId: 'graph-mode-tab-normal' },
  { mode: 'sandbox', label: 'Sandbox', tabId: 'graph-mode-tab-sandbox' },
  { mode: 'views', label: 'My views', tabId: 'graph-mode-tab-views' },
];

type WorkspaceModeNavProps = {
  mode: GraphMode | null;
  sandboxDirty: boolean;
  onModeChange: (mode: GraphMode) => void;
};

export function WorkspaceModeNav({ mode, sandboxDirty, onModeChange }: WorkspaceModeNavProps) {
  return (
    <div className="sidebar-subnav" role="tablist" aria-label="Workspace views">
      {WORKSPACE_MODES.map((view) => {
        const isActive = mode === view.mode;
        const showDraft = view.mode === 'sandbox' && sandboxDirty && isActive;
        return (
          <SidebarSubItem
            key={view.mode}
            id={view.tabId}
            label={view.label}
            isActive={isActive}
            onClick={() => {
              if (!isActive) onModeChange(view.mode);
            }}
            trailing={showDraft ? <span className="graph-mode-tab__draft" aria-label="Unsaved draft" /> : null}
          />
        );
      })}
    </div>
  );
}

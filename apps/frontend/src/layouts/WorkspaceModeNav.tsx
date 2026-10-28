import type { GraphMode } from '@/features/map/components/GraphModeTabs';
import { SidebarSubItem } from './SidebarSubItem';

const WORKSPACE_MODES: { mode: GraphMode; label: string; tabId: string; tone: 'production' | 'sandbox' | 'views' }[] = [
  { mode: 'normal', label: 'Production', tabId: 'graph-mode-tab-normal', tone: 'production' },
  { mode: 'sandbox', label: 'Sandbox', tabId: 'graph-mode-tab-sandbox', tone: 'sandbox' },
  { mode: 'views', label: 'My views', tabId: 'graph-mode-tab-views', tone: 'views' },
];

type WorkspaceModeNavProps = {
  id: string;
  mode: GraphMode | null;
  sandboxDirty: boolean;
  onModeChange: (mode: GraphMode) => void;
};

export function WorkspaceModeNav({ id, mode, sandboxDirty, onModeChange }: WorkspaceModeNavProps) {
  return (
    <div id={id} className="sidebar-subnav" role="tablist" aria-label="Workspace views">
      {WORKSPACE_MODES.map((view) => {
        const isActive = mode === view.mode;
        const showDraft = view.mode === 'sandbox' && sandboxDirty && isActive;
        return (
          <SidebarSubItem
            key={view.mode}
            id={view.tabId}
            label={view.label}
            tone={view.tone}
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

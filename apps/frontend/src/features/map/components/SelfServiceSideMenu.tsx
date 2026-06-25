import { type ReactNode } from 'react';
import type { GraphMode } from './GraphModeTabs';
import { SelfServiceToolBar, type SideMenuTool } from './SelfServiceToolBar';

type SelfServiceBurgerProps = {
  isOpen: boolean;
  onToggle: () => void;
};

type SelfServiceSideMenuProps = {
  isOpen: boolean;
  onToggle: () => void;
  graphMode: GraphMode;
  sandboxDirty: boolean;
  filtersActive: boolean;
  activeTool: SideMenuTool;
  onActiveToolChange: (tool: SideMenuTool) => void;
  onModeChange: (mode: GraphMode) => void;
  toolDetail: ReactNode;
};

const VIEWS: { mode: GraphMode; label: string; tabId: string; accent: string }[] = [
  {
    mode: 'normal',
    label: 'Information System Explorer',
    tabId: 'graph-mode-tab-normal',
    accent: 'explorer',
  },
  {
    mode: 'sandbox',
    label: 'Impact Sandbox',
    tabId: 'graph-mode-tab-sandbox',
    accent: 'sandbox',
  },
  {
    mode: 'views',
    label: 'My views',
    tabId: 'graph-mode-tab-views',
    accent: 'views',
  },
];

const TOOL_DETAIL_TITLES: Record<SideMenuTool, string> = {
  search: 'Search applications',
  filters: 'Filters',
  actions: 'Corrections',
};

export function SelfServiceBurger({ isOpen, onToggle }: SelfServiceBurgerProps) {
  return (
    <button
      type="button"
      className={`self-service-burger${isOpen ? ' is-open' : ''}`}
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-controls="self-service-side-menu"
      aria-label={isOpen ? 'Close menu' : 'Open menu'}
    >
      <span className="self-service-burger-icon" aria-hidden="true" />
    </button>
  );
}

export function SelfServiceSideMenu({
  isOpen,
  onToggle,
  graphMode,
  sandboxDirty,
  filtersActive,
  activeTool,
  onActiveToolChange,
  onModeChange,
  toolDetail,
}: SelfServiceSideMenuProps) {
  const showGraphTools = graphMode === 'normal' || graphMode === 'sandbox';
  const toolDetailTitle =
    activeTool === 'actions'
      ? graphMode === 'sandbox'
        ? 'Toolkit'
        : 'Corrections'
      : TOOL_DETAIL_TITLES[activeTool];

  return (
    <div
      className={`self-service-side-menu-shell${isOpen ? ' is-open' : ''}${showGraphTools ? ' is-expanded' : ''}`}
      aria-hidden={!isOpen}
    >
      <nav
        id="self-service-side-menu"
        className="self-service-side-menu"
        aria-label="Self Service navigation"
      >
        <header className="self-service-side-menu-header">
          <p className="graph-drawer-eyebrow">Self Service</p>
          <button
            type="button"
            className="graph-drawer-close"
            onClick={onToggle}
            aria-label="Close menu"
          >
            x
          </button>
        </header>

        <div className="self-service-side-menu-body">
          <section className="self-service-side-menu-section" aria-labelledby="self-service-views-heading">
            <h2 id="self-service-views-heading" className="self-service-side-menu-section-title">
              Views
            </h2>
            <div className="self-service-view-list" role="tablist" aria-label="Workspace views">
              {VIEWS.map((view) => {
                const isActive = graphMode === view.mode;
                return (
                  <button
                    key={view.mode}
                    type="button"
                    role="tab"
                    id={view.tabId}
                    className={`self-service-view-item self-service-view-item--${view.accent}${isActive ? ' is-active' : ''}`}
                    aria-selected={isActive}
                    aria-controls={view.mode === 'views' ? 'graph-views-pane' : 'graph-canvas-pane'}
                    onClick={() => {
                      if (!isActive) onModeChange(view.mode);
                    }}
                  >
                    <span className="self-service-view-item-label">{view.label}</span>
                    {view.mode === 'sandbox' && sandboxDirty && isActive ? (
                      <span className="graph-mode-tab__draft" aria-label="Unsaved draft" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>

          {showGraphTools ? (
            <>
              <SelfServiceToolBar
                graphMode={graphMode}
                filtersActive={filtersActive}
                activeTool={activeTool}
                onChange={onActiveToolChange}
              />
              <div
                className="self-service-tool-detail"
                role="tabpanel"
                aria-label={toolDetailTitle}
              >
                <h3 className="self-service-tool-detail-title">{toolDetailTitle}</h3>
                {toolDetail}
              </div>
            </>
          ) : null}
        </div>
      </nav>
    </div>
  );
}

export type { SideMenuTool } from './SelfServiceToolBar';

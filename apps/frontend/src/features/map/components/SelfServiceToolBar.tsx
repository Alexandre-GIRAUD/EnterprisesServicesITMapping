import type { GraphMode } from './GraphModeTabs';

export type SideMenuTool = 'changes' | 'search' | 'filters' | 'actions';

type SelfServiceToolBarProps = {
  graphMode: GraphMode;
  filtersActive: boolean;
  activeTool: SideMenuTool;
  onChange: (tool: SideMenuTool) => void;
  pendingChangeCount?: number;
};

function ChangesIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M4.5 3.5 H13.5 A1.5 1.5 0 0 1 15 5 V15.5 A1.5 1.5 0 0 1 13.5 17 H4.5 A1.5 1.5 0 0 1 3 15.5 V5 A1.5 1.5 0 0 1 4.5 3.5 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M6.5 7.5 H11.5 M6.5 10.5 H11.5 M6.5 13.5 H9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="14.5" cy="5.5" r="2.6" fill="currentColor" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <circle cx="8.5" cy="8.5" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12.2 12.2 L16.5 16.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FiltersIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M3.5 4.5 H16.5 M6 10 H14 M8.5 15.5 H11.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ActionsIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M7.2 4.2 L12.8 5.4 L11.6 11 L6 9.8 Z M13.2 9.2 L15.8 14.2 L10.8 16.8 L8.2 11.8 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SelfServiceToolBar({
  graphMode,
  filtersActive,
  activeTool,
  onChange,
  pendingChangeCount = 0,
}: SelfServiceToolBarProps) {
  const isExplorer = graphMode === 'normal';
  const isSandbox = graphMode === 'sandbox';
  const actionsLabel = isExplorer ? 'Corrections' : 'Toolkit';

  return (
    <div className="self-service-tool-bar" role="tablist" aria-label="View tools">
      {isExplorer ? (
        <button
          type="button"
          role="tab"
          className={`self-service-tool-bar-btn${activeTool === 'changes' ? ' is-active' : ''}`}
          aria-selected={activeTool === 'changes'}
          aria-label={
            pendingChangeCount > 0
              ? `Pending changes (${pendingChangeCount})`
              : 'Pending changes'
          }
          title="Pending changes"
          onClick={() => onChange('changes')}
        >
          <ChangesIcon />
          {pendingChangeCount > 0 ? (
            <span className="self-service-tool-bar-badge" aria-hidden="true">
              {pendingChangeCount > 99 ? '99+' : pendingChangeCount}
            </span>
          ) : null}
        </button>
      ) : null}
      {isSandbox ? (
        <button
          type="button"
          role="tab"
          className={`self-service-tool-bar-btn${activeTool === 'search' ? ' is-active' : ''}`}
          aria-selected={activeTool === 'search'}
          aria-label="Search applications"
          title="Search applications"
          onClick={() => onChange('search')}
        >
          <SearchIcon />
        </button>
      ) : null}
      <button
        type="button"
        role="tab"
        className={`self-service-tool-bar-btn${activeTool === 'filters' ? ' is-active' : ''}`}
        aria-selected={activeTool === 'filters'}
        aria-label={filtersActive ? 'Filters (on)' : 'Filters'}
        title="Filters"
        onClick={() => onChange('filters')}
      >
        <FiltersIcon />
        {filtersActive ? (
          <span className="self-service-tool-bar-badge" aria-hidden="true">
            On
          </span>
        ) : null}
      </button>
      <button
        type="button"
        role="tab"
        className={`self-service-tool-bar-btn${activeTool === 'actions' ? ' is-active' : ''}`}
        aria-selected={activeTool === 'actions'}
        aria-label={actionsLabel}
        title={actionsLabel}
        onClick={() => onChange('actions')}
      >
        <ActionsIcon />
      </button>
    </div>
  );
}

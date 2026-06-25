import type { GraphMode } from './GraphModeTabs';

export type SideMenuTool = 'search' | 'filters' | 'actions';

type SelfServiceToolBarProps = {
  graphMode: GraphMode;
  filtersActive: boolean;
  activeTool: SideMenuTool;
  onChange: (tool: SideMenuTool) => void;
};

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
}: SelfServiceToolBarProps) {
  const isExplorer = graphMode === 'normal';
  const actionsLabel = isExplorer ? 'Corrections' : 'Toolkit';

  return (
    <div
      className="self-service-tool-bar"
      role="tablist"
      aria-label="View tools"
    >
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

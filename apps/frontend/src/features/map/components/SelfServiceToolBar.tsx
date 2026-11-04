import type { GraphMode } from './GraphModeTabs';

export type SideMenuTool = 'changes' | 'filters' | 'actions' | 'sandboxes' | 'chat';

type SelfServiceToolBarProps = {
  graphMode: GraphMode;
  filtersActive: boolean;
  activeTool: SideMenuTool;
  onChange: (tool: SideMenuTool) => void;
  canCorrect?: boolean;
};

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
      <rect
        x="2.75"
        y="3.25"
        width="10.5"
        height="13.5"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M10.2 12.7 L14.6 8.3 L16.1 9.8 L11.7 14.2 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M10.2 12.7 L8.6 15.2 L11.7 14.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M4 4.5 H16 V12.5 H8.2 L4.5 15.2 V12.5 H4 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const GRID_PLUS_PATH =
  'M12 3v17a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1H3 M16 19h6 M19 16v6';
const GRID_ICON_SIZE = 18;
const GRID_ICON_STROKE_WIDTH = 1.7;

function SandboxesIcon() {
  return (
    <svg viewBox="0 0 24 24" width={GRID_ICON_SIZE} height={GRID_ICON_SIZE} aria-hidden="true" focusable="false">
      <path
        d={GRID_PLUS_PATH}
        fill="none"
        stroke="currentColor"
        strokeWidth={GRID_ICON_STROKE_WIDTH}
        strokeLinecap="round"
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
  canCorrect = true,
}: SelfServiceToolBarProps) {
  const isExplorer = graphMode === 'normal';
  const actionsLabel = isExplorer ? 'Corrections' : 'Toolkit';

  return (
    <div className="self-service-tool-bar" role="tablist" aria-label="View tools">
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
      {canCorrect ? (
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
      ) : null}
      {isExplorer ? (
        <button
          type="button"
          role="tab"
          className={`self-service-tool-bar-btn${activeTool === 'chat' ? ' is-active' : ''}`}
          aria-selected={activeTool === 'chat'}
          aria-label="Chat"
          title="Chat"
          onClick={() => onChange('chat')}
        >
          <ChatIcon />
        </button>
      ) : null}
      {graphMode === 'sandbox' ? (
        <button
          type="button"
          role="tab"
          className={`self-service-tool-bar-btn${activeTool === 'sandboxes' ? ' is-active' : ''}`}
          aria-selected={activeTool === 'sandboxes'}
          aria-label="My sandboxes"
          title="My sandboxes"
          onClick={() => onChange('sandboxes')}
        >
          <SandboxesIcon />
        </button>
      ) : null}
    </div>
  );
}

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { CloseIcon } from './CloseIcon';
import type { GraphMode } from './GraphModeTabs';
import { SelfServiceToolBar, type SideMenuTool } from './SelfServiceToolBar';
import {
  DEFAULT_MENU_WIDTH,
  EXPANDED_MENU_WIDTH,
  MENU_RESIZE_STEP,
  MIN_MENU_WIDTH,
  clampMenuWidth,
  maxMenuWidth,
} from './sideMenuWidth';

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
  pendingChangeCount?: number;
  /** When true (table view), hide tool rail and show Columns panel only. */
  columnsOnly?: boolean;
  columnsDetail?: ReactNode;
};

const VIEWS: { mode: GraphMode; label: string; tabId: string; accent: string }[] = [
  {
    mode: 'normal',
    label: 'Production',
    tabId: 'graph-mode-tab-normal',
    accent: 'explorer',
  },
  {
    mode: 'sandbox',
    label: 'Sandbox',
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

const MENU_WIDTH_STORAGE_KEY = 'flowra.sideMenu.width';
const NARROW_MENU_QUERY = '(max-width: 640px)';

const TOOL_DETAIL_TITLES: Record<SideMenuTool, string> = {
  changes: 'Pending changes',
  chat: 'IT mapping chat',
  search: 'Search applications',
  filters: 'Filters',
  actions: 'Corrections',
  sandboxes: 'My sandboxes',
};

function useResizableMenu(isOpen: boolean, defaultWidth: number) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startWidth: number; panelWidth: number } | null>(null);
  const [userWidth, setUserWidth] = useState<number | null>(readStoredMenuWidth);
  const [isResizing, setIsResizing] = useState(false);
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia(NARROW_MENU_QUERY).matches);

  useEffect(() => {
    const query = window.matchMedia(NARROW_MENU_QUERY);
    const onChange = () => setIsNarrow(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    function onResize() {
      const panel = shellRef.current?.parentElement?.clientWidth;
      if (panel == null) return;
      setUserWidth((current) => {
        if (current == null) return current;
        const next = clampMenuWidth(current, panel);
        if (next === current) return current;
        localStorage.setItem(MENU_WIDTH_STORAGE_KEY, String(next));
        return next;
      });
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  function panelWidth(): number {
    return shellRef.current?.parentElement?.clientWidth ?? window.innerWidth;
  }

  function storeWidth(next: number) {
    setUserWidth(next);
    localStorage.setItem(MENU_WIDTH_STORAGE_KEY, String(next));
  }

  function restoreDefault() {
    setUserWidth(null);
    localStorage.removeItem(MENU_WIDTH_STORAGE_KEY);
  }

  function onResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      startX: event.clientX,
      startWidth: shellRef.current?.getBoundingClientRect().width ?? defaultWidth,
      panelWidth: panelWidth(),
    };
    setIsResizing(true);
  }

  function onResizePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    storeWidth(clampMenuWidth(drag.startWidth + (drag.startX - event.clientX), drag.panelWidth));
  }

  function onResizePointerUp() {
    dragRef.current = null;
    setIsResizing(false);
  }

  function onResizeKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const current = userWidth ?? defaultWidth;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      storeWidth(clampMenuWidth(current + MENU_RESIZE_STEP, panelWidth()));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      storeWidth(clampMenuWidth(current - MENU_RESIZE_STEP, panelWidth()));
    } else if (event.key === 'Home') {
      event.preventDefault();
      restoreDefault();
    } else if (event.key === 'End') {
      event.preventDefault();
      storeWidth(maxMenuWidth(panelWidth()));
    }
  }

  const customWidth = isOpen && !isNarrow && userWidth != null ? userWidth : null;
  return {
    shellRef,
    isResizing,
    isNarrow,
    customWidth,
    currentWidth: customWidth ?? defaultWidth,
    maxWidth: maxMenuWidth(panelWidth()),
    restoreDefault,
    onResizePointerDown,
    onResizePointerMove,
    onResizePointerUp,
    onResizeKeyDown,
  };
}

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
      {isOpen ? <CloseIcon /> : <span className="self-service-burger-icon" aria-hidden="true" />}
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
  pendingChangeCount = 0,
  columnsOnly = false,
  columnsDetail = null,
}: SelfServiceSideMenuProps) {
  const showGraphTools = graphMode === 'normal' || graphMode === 'sandbox';
  const defaultWidth = showGraphTools ? EXPANDED_MENU_WIDTH : DEFAULT_MENU_WIDTH;
  const resize = useResizableMenu(isOpen, defaultWidth);
  const toolDetailTitle = columnsOnly
    ? 'Columns'
    : activeTool === 'actions'
      ? graphMode === 'sandbox'
        ? 'Toolkit'
        : 'Corrections'
      : TOOL_DETAIL_TITLES[activeTool];

  return (
    <div
      ref={resize.shellRef}
      className={`self-service-side-menu-shell${isOpen ? ' is-open' : ''}${showGraphTools ? ' is-expanded' : ''}${resize.isResizing ? ' is-resizing' : ''}`}
      style={
        resize.customWidth != null
          ? { width: resize.customWidth, flexBasis: resize.customWidth, minWidth: resize.customWidth }
          : undefined
      }
      aria-hidden={!isOpen}
    >
      {isOpen && !resize.isNarrow ? (
        <div
          className="self-service-menu-resize"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize menu"
          aria-valuemin={MIN_MENU_WIDTH}
          aria-valuemax={resize.maxWidth}
          aria-valuenow={resize.currentWidth}
          tabIndex={0}
          onPointerDown={resize.onResizePointerDown}
          onPointerMove={resize.onResizePointerMove}
          onPointerUp={resize.onResizePointerUp}
          onPointerCancel={resize.onResizePointerUp}
          onDoubleClick={resize.restoreDefault}
          onKeyDown={resize.onResizeKeyDown}
        />
      ) : null}
      <nav
        id="self-service-side-menu"
        className="self-service-side-menu"
        aria-label="Cartography navigation"
      >
        <header className="self-service-side-menu-header">
          <p className="graph-drawer-eyebrow">Cartography</p>
          <button
            type="button"
            className="graph-drawer-close"
            onClick={onToggle}
            aria-label="Close menu"
          >
            <CloseIcon />
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
              {columnsOnly ? null : (
                <>
                  {graphMode === 'normal' ? (
                    <button
                      type="button"
                      className={`self-service-changes-entry${activeTool === 'changes' ? ' is-active' : ''}`}
                      aria-pressed={activeTool === 'changes'}
                      onClick={() => onActiveToolChange('changes')}
                    >
                      <span>Changes</span>
                      <span className="self-service-changes-entry-count">
                        {pendingChangeCount > 99 ? '99+' : pendingChangeCount}
                      </span>
                    </button>
                  ) : null}
                  <SelfServiceToolBar
                    graphMode={graphMode}
                    filtersActive={filtersActive}
                    activeTool={activeTool}
                    onChange={onActiveToolChange}
                  />
                </>
              )}
              <div
                className="self-service-tool-detail"
                role="tabpanel"
                aria-label={toolDetailTitle}
              >
                <h3 className="self-service-tool-detail-title">{toolDetailTitle}</h3>
                {columnsOnly ? columnsDetail : toolDetail}
              </div>
            </>
          ) : null}
        </div>
      </nav>
    </div>
  );
}

function readStoredMenuWidth(): number | null {
  const raw = localStorage.getItem(MENU_WIDTH_STORAGE_KEY);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export type { SideMenuTool } from './SelfServiceToolBar';

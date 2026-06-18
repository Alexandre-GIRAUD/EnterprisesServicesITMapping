export type GraphMode = 'normal' | 'sandbox' | 'views';

type GraphModeTabsProps = {
  mode: GraphMode;
  sandboxDirty?: boolean;
  onModeChange: (mode: GraphMode) => void;
};

export function GraphModeTabs({ mode, sandboxDirty = false, onModeChange }: GraphModeTabsProps) {
  return (
    <div className="graph-mode-tabs" role="tablist" aria-label="Graph mode">
      <button
        type="button"
        role="tab"
        id="graph-mode-tab-normal"
        className={`graph-mode-tab${mode === 'normal' ? ' is-active' : ''}`}
        aria-selected={mode === 'normal'}
        aria-controls="graph-canvas-pane"
        onClick={() => {
          if (mode !== 'normal') onModeChange('normal');
        }}
      >
        Information System Explorer
      </button>
      <button
        type="button"
        role="tab"
        id="graph-mode-tab-sandbox"
        className={`graph-mode-tab graph-mode-tab--sandbox${mode === 'sandbox' ? ' is-active' : ''}`}
        aria-selected={mode === 'sandbox'}
        aria-controls="graph-canvas-pane"
        onClick={() => {
          if (mode !== 'sandbox') onModeChange('sandbox');
        }}
      >
        Impact Sandbox
        {sandboxDirty && mode === 'sandbox' ? (
          <span className="graph-mode-tab__draft" aria-label="Unsaved draft" />
        ) : null}
      </button>
      <button
        type="button"
        role="tab"
        id="graph-mode-tab-views"
        className={`graph-mode-tab graph-mode-tab--views${mode === 'views' ? ' is-active' : ''}`}
        aria-selected={mode === 'views'}
        aria-controls="graph-views-pane"
        onClick={() => {
          if (mode !== 'views') onModeChange('views');
        }}
      >
        My views
      </button>
    </div>
  );
}

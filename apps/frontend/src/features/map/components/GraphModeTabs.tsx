export type GraphMode = 'normal' | 'sandbox';

type GraphModeTabsProps = {
  mode: GraphMode;
  sandboxDirty?: boolean;
  onModeChange: (mode: GraphMode) => void;
};

export function GraphModeTabs({ mode, sandboxDirty = false, onModeChange }: GraphModeTabsProps) {
  return (
    <div className="graph-mode-tabs" role="tablist" aria-label="Mode du graphe">
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
        Normal
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
        Sandbox
        {sandboxDirty && mode === 'sandbox' ? (
          <span className="graph-mode-tab__draft" aria-label="Brouillon non sauvegardé" />
        ) : null}
      </button>
    </div>
  );
}

export type GraphDisplayMode = 'graph' | 'table';

type GraphDisplayToggleProps = {
  displayMode: GraphDisplayMode;
  onChange: (mode: GraphDisplayMode) => void;
};

function GraphIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <circle cx="5" cy="5" r="2.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="15" cy="6" r="2.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="15" r="2.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M6.8 6.2 L13.2 7.3 M7.2 6.8 L9.2 13.2 M13.8 7.7 L11.2 13.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <rect
        x="3"
        y="4"
        width="14"
        height="12"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M3 8.5 H17 M3 12.5 H17 M8 8.5 V16" fill="none" stroke="currentColor" strokeWidth="1.35" />
    </svg>
  );
}

export function GraphDisplayToggle({ displayMode, onChange }: GraphDisplayToggleProps) {
  return (
    <div
      className="graph-display-toggle"
      role="tablist"
      aria-label="Graph display mode"
    >
      <button
        type="button"
        role="tab"
        className={`graph-display-toggle-btn${displayMode === 'graph' ? ' is-active' : ''}`}
        aria-selected={displayMode === 'graph'}
        aria-label="Graphs view"
        title="Graphs"
        onClick={() => onChange('graph')}
      >
        <GraphIcon />
        <span className="graph-display-toggle-label">Graphs</span>
      </button>
      <button
        type="button"
        role="tab"
        className={`graph-display-toggle-btn${displayMode === 'table' ? ' is-active' : ''}`}
        aria-selected={displayMode === 'table'}
        aria-label="Tables view"
        title="Tables"
        onClick={() => onChange('table')}
      >
        <TableIcon />
        <span className="graph-display-toggle-label">Tables</span>
      </button>
    </div>
  );
}

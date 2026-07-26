export type TableContentMode = 'apps' | 'flows';

type TableContentToggleProps = {
  value: TableContentMode;
  onChange: (mode: TableContentMode) => void;
};

export function TableContentToggle({ value, onChange }: TableContentToggleProps) {
  return (
    <div className="graph-display-toggle" role="tablist" aria-label="Table content">
      <button
        type="button"
        role="tab"
        className={`graph-display-toggle-btn${value === 'apps' ? ' is-active' : ''}`}
        aria-selected={value === 'apps'}
        aria-label="Apps table"
        title="Apps"
        onClick={() => onChange('apps')}
      >
        <span className="graph-display-toggle-label">Apps</span>
      </button>
      <button
        type="button"
        role="tab"
        className={`graph-display-toggle-btn${value === 'flows' ? ' is-active' : ''}`}
        aria-selected={value === 'flows'}
        aria-label="Flows table"
        title="Flows"
        onClick={() => onChange('flows')}
      >
        <span className="graph-display-toggle-label">Flows</span>
      </button>
    </div>
  );
}

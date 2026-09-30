export type TableContentMode = 'apps' | 'flows';

export type TableViewMode = TableContentMode | 'custom';

type TableContentToggleProps = {
  value: TableViewMode;
  onChange: (mode: TableViewMode) => void;
};

export function TableContentToggle({ value, onChange }: TableContentToggleProps) {
  return (
    <div className="graph-display-toggle" role="tablist" aria-label="Table content">
      <TableTab label="Apps" pressed={value === 'apps'} onClick={() => onChange('apps')} />
      <TableTab label="Flows" pressed={value === 'flows'} onClick={() => onChange('flows')} />
      <TableTab label="Create table" pressed={value === 'custom'} onClick={() => onChange('custom')} />
    </div>
  );
}

function TableTab({ label, pressed, onClick }: { label: string; pressed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      className={`graph-display-toggle-btn${pressed ? ' is-active' : ''}`}
      aria-selected={pressed}
      aria-label={label === 'Create table' ? 'Create table' : `${label} table`}
      title={label}
      onClick={onClick}
    >
      <span className="graph-display-toggle-label">{label}</span>
    </button>
  );
}

import type { AttributeFilters, DetectionFilter } from '../dataModelAttributes';
import { DataModelIcon, type DataModelIconName } from './DataModelIcons';

const DETECTION_OPTIONS: Array<{ value: DetectionFilter; label: string }> = [
  { value: 'ALL', label: 'All detection modes' },
  { value: 'AUTOMATIC_DETECTION', label: 'AI detection' },
  { value: 'MANUAL', label: 'Manual' },
];

type DataModelToolbarProps = {
  counts: { total: number; manual: number; automatic: number };
  filters: AttributeFilters;
  onFiltersChange: (filters: AttributeFilters) => void;
};

function ToolbarStat({ icon, value, label }: { icon: DataModelIconName; value: number; label: string }) {
  return (
    <div className="data-model-stat">
      <span className="data-model-stat-icon">
        <DataModelIcon name={icon} size={18} />
      </span>
      <span>
        <strong className="data-model-stat-value">{value}</strong>
        {label}
      </span>
    </div>
  );
}

function countActiveFilters(filters: AttributeFilters): number {
  return [filters.detection !== 'ALL', filters.isRequiredOnly, filters.isControlledOnly].filter(Boolean)
    .length;
}

export function DataModelToolbar({ counts, filters, onFiltersChange }: DataModelToolbarProps) {
  const activeFilterCount = countActiveFilters(filters);
  const update = (patch: Partial<AttributeFilters>) => onFiltersChange({ ...filters, ...patch });

  return (
    <div className="data-model-toolbar">
      <div className="data-model-stats">
        <ToolbarStat icon="cube" value={counts.total} label="attributes" />
        <ToolbarStat icon="user" value={counts.manual} label="manual" />
        <ToolbarStat icon="sparkle" value={counts.automatic} label="detected by AI" />
      </div>
      <label className="data-model-search">
        <DataModelIcon name="search" />
        <input
          type="search"
          value={filters.query}
          onChange={(event) => update({ query: event.target.value })}
          placeholder="Search an attribute…"
          aria-label="Search by key or label"
        />
      </label>
      <details className="data-model-filters">
        <summary className="data-model-filters-button">
          <DataModelIcon name="filter" />
          Filters
          {activeFilterCount > 0 ? <span className="data-model-filters-count">{activeFilterCount}</span> : null}
          <DataModelIcon name="chevronDown" size={14} />
        </summary>
        <div className="data-model-filters-panel">
          <label className="data-model-label">
            Detection mode
            <select
              className="data-model-input"
              value={filters.detection}
              onChange={(event) => update({ detection: event.target.value as DetectionFilter })}
            >
              {DETECTION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="data-model-check">
            <input
              type="checkbox"
              checked={filters.isRequiredOnly}
              onChange={(event) => update({ isRequiredOnly: event.target.checked })}
            />
            Required only
          </label>
          <label className="data-model-check">
            <input
              type="checkbox"
              checked={filters.isControlledOnly}
              onChange={(event) => update({ isControlledOnly: event.target.checked })}
            />
            Controlled values only
          </label>
        </div>
      </details>
    </div>
  );
}

import { useEffect, useMemo, useState, type Ref } from 'react';
import type { ApplicationResponse, GraphNodeDto, GraphNodeFilterDto } from '@/types/api';
import { nodeFillColorForValue } from './edgeColorProperty';
import {
  buildPivotTable,
  collectPivotApps,
  type PivotDimension,
  type PivotSetup,
} from '../utils/pivotTable';

const MISSING_COLOR = '#94a3b8';
const NONE_AXIS = '';

type CustomPivotPanelProps = {
  nodes: GraphNodeDto[];
  applications: ApplicationResponse[];
  dimensions: GraphNodeFilterDto[];
  colorMap?: Record<string, string>;
  setup: PivotSetup | null;
  editing: boolean;
  onApply: (setup: PivotSetup) => void;
  onCancel: () => void;
  exportRootRef: Ref<HTMLDivElement>;
};

export function CustomPivotPanel({
  nodes,
  applications,
  dimensions,
  colorMap,
  setup,
  editing,
  onApply,
  onCancel,
  exportRootRef,
}: CustomPivotPanelProps) {
  const axes = useMemo<PivotDimension[]>(
    () =>
      dimensions
        .filter((dimension) => dimension.kind !== 'EDGE')
        .map((dimension) => ({
          key: dimension.key,
          kind: dimension.kind === 'NODE_REF' ? 'NODE_REF' : 'NODE',
        })),
    [dimensions],
  );
  const labels = useMemo(() => {
    const map = new Map<string, string>();
    for (const dimension of dimensions) {
      map.set(dimension.key, dimension.label?.trim() || dimension.key);
    }
    return map;
  }, [dimensions]);

  if (editing || !setup) {
    return (
      <PivotSetupForm
        axes={axes}
        labels={labels}
        initial={setup}
        onApply={onApply}
        onCancel={onCancel}
      />
    );
  }

  const apps = collectPivotApps(nodes, applications, axes);
  const pivot = buildPivotTable(apps, setup);
  const axisLabel = (key: string) => labels.get(key) ?? key;

  return (
    <div
      ref={exportRootRef}
      className="pivot-table graph-table-panel graph-table-panel--main graph-table-panel--light"
      aria-label="Custom table"
    >
      <p className="pivot-table-caption">
        {axisLabel(setup.rowKey)} × {axisLabel(setup.columnKey)}
      </p>
      {pivot.rowLabels.length === 0 ? (
        <p className="graph-table-message">No apps to display.</p>
      ) : (
        <div className="graph-table-scroll">
          <table className="graph-table">
            <thead>
              <tr>
                <th>{axisLabel(setup.rowKey)}</th>
                {pivot.columnLabels.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pivot.rowLabels.map((row, rowIndex) => (
                <tr key={row}>
                  <th scope="row">{row}</th>
                  {pivot.columnLabels.map((column, columnIndex) => (
                    <td key={column}>
                      <div className="pivot-badges">
                        {pivot.cells[rowIndex][columnIndex].map((badge) => (
                          <span
                            key={badge.appId}
                            className="pivot-badge"
                            style={{ background: badgeColor(setup, badge.colorValue, colorMap) }}
                          >
                            {badge.text}
                          </span>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function badgeColor(setup: PivotSetup, colorValue: string | null, colorMap?: Record<string, string>): string {
  if (!setup.colorKey) return '#e2e8f0';
  if (!colorValue) return MISSING_COLOR;
  return nodeFillColorForValue(setup.colorKey, colorValue, colorMap);
}

function PivotSetupForm({
  axes,
  labels,
  initial,
  onApply,
  onCancel,
}: {
  axes: PivotDimension[];
  labels: Map<string, string>;
  initial: PivotSetup | null;
  onApply: (setup: PivotSetup) => void;
  onCancel: () => void;
}) {
  const [rowKey, setRowKey] = useState(initial?.rowKey ?? axes[0]?.key ?? '');
  const [columnKey, setColumnKey] = useState(initial?.columnKey ?? axes[1]?.key ?? axes[0]?.key ?? '');
  const [labelKey, setLabelKey] = useState(initial?.labelKey ?? NONE_AXIS);
  const [colorKey, setColorKey] = useState(initial?.colorKey ?? NONE_AXIS);

  useEffect(() => {
    if (!rowKey && axes[0]) setRowKey(axes[0].key);
    if (!columnKey && axes[0]) setColumnKey(axes[1]?.key ?? axes[0].key);
  }, [axes, rowKey, columnKey]);

  return (
    <form
      className="pivot-setup graph-table-panel graph-table-panel--main graph-table-panel--light"
      onSubmit={(event) => {
        event.preventDefault();
        if (!rowKey || !columnKey) return;
        onApply({
          rowKey,
          columnKey,
          labelKey: labelKey || null,
          colorKey: colorKey || null,
        });
      }}
    >
      <AxisSelect label="Row" value={rowKey} axes={axes} labels={labels} allowEmpty={false} onChange={setRowKey} />
      <AxisSelect label="Column" value={columnKey} axes={axes} labels={labels} allowEmpty={false} onChange={setColumnKey} />
      <AxisSelect label="Label" value={labelKey} axes={axes} labels={labels} allowEmpty onChange={setLabelKey} />
      <AxisSelect label="Color" value={colorKey} axes={axes} labels={labels} allowEmpty onChange={setColorKey} />
      <div className="pivot-setup-actions">
        <button type="submit" className="graph-drawer-action" disabled={!rowKey || !columnKey}>
          <span className="graph-drawer-action-title">Show table</span>
        </button>
        <button type="button" className="graph-drawer-action" onClick={onCancel}>
          <span className="graph-drawer-action-title">Cancel</span>
        </button>
      </div>
    </form>
  );
}

function AxisSelect({
  label,
  value,
  axes,
  labels,
  allowEmpty,
  onChange,
}: {
  label: string;
  value: string;
  axes: PivotDimension[];
  labels: Map<string, string>;
  allowEmpty: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="pivot-setup-field">
      <span>{label}</span>
      <select className="graph-drawer-input" value={value} aria-label={label} onChange={(event) => onChange(event.target.value)}>
        {allowEmpty ? <option value={NONE_AXIS}>None</option> : null}
        {axes.map((axis) => (
          <option key={axis.key} value={axis.key}>
            {labels.get(axis.key) ?? axis.key}
          </option>
        ))}
      </select>
    </label>
  );
}

import { useEffect, useMemo, useState, type Ref } from 'react';
import type { ApplicationResponse, GraphEdgeDto, GraphNodeDto, GraphNodeFilterDto } from '@/types/api';
import { nodeFillColorForValue } from './edgeColorProperty';
import {
  EMPTY_CUSTOM_VALUE,
  axisRef,
  buildAxisOptions,
  buildCustomTable,
  collectCustomTableFacts,
  customTableGrid,
  loadSavedCustomTables,
  normalizeSetup,
  optionsForSlot,
  reconcileSavedTable,
  storeSavedCustomTables,
  type AxisOption,
  type CustomTableModel,
  type CustomTableSetup,
  type SavedCustomTable,
} from '../utils/customTable';

const EMPTY_SETUP: CustomTableSetup = { row: null, column: null, label: null, color: null };
const MISSING_COLOR = '#94a3b8';
const PLAIN_BADGE_COLOR = '#e2e8f0';
const COPY_SUFFIX = ' copy';

export type CreateTableExportState = {
  setup: CustomTableSetup;
  status: CustomTableModel['status'];
  grid: { headers: string[]; rows: string[][] } | null;
};

type CreateTablePanelProps = {
  nodes: GraphNodeDto[];
  applications: ApplicationResponse[];
  edges: GraphEdgeDto[];
  dimensions: GraphNodeFilterDto[];
  colorMap?: Record<string, string>;
  status: 'loading' | 'ready' | 'error';
  errorMessage?: string | null;
  exportRootRef: Ref<HTMLDivElement>;
  onViewChange: (view: CreateTableExportState) => void;
};

export function CreateTablePanel({
  nodes,
  applications,
  edges,
  dimensions,
  colorMap,
  status,
  errorMessage,
  exportRootRef,
  onViewChange,
}: CreateTablePanelProps) {
  const options = useMemo(() => buildAxisOptions(dimensions), [dimensions]);
  const facts = useMemo(
    () => collectCustomTableFacts(nodes, applications, edges, dimensions),
    [nodes, applications, edges, dimensions],
  );
  const [setup, setSetup] = useState<CustomTableSetup>(EMPTY_SETUP);
  const [savedTables, setSavedTables] = useState<SavedCustomTable[]>(loadSavedCustomTables);
  const [selectedId, setSelectedId] = useState('');
  const [tableName, setTableName] = useState('');
  const [missingLabels, setMissingLabels] = useState<string[]>([]);

  const reconciled = useMemo(
    () =>
      reconcileSavedTable(
        { id: 'live', name: 'live', row: axisRef(setup.row), column: axisRef(setup.column), label: axisRef(setup.label), color: axisRef(setup.color) },
        options,
      ),
    [setup, options],
  );
  const activeSetup = reconciled.setup;
  const model = useMemo(
    () => buildCustomTable({ setup: activeSetup, apps: facts.apps, flows: facts.flows }),
    [activeSetup, facts],
  );

  useEffect(() => {
    if (reconciled.missingLabels.length === 0) return;
    setMissingLabels(reconciled.missingLabels);
    setSetup(activeSetup);
  }, [reconciled.missingLabels, activeSetup]);

  useEffect(() => {
    onViewChange({ setup: activeSetup, status: model.status, grid: customTableGrid(model) });
  }, [activeSetup, model, onViewChange]);

  useEffect(() => {
    storeSavedCustomTables(savedTables);
  }, [savedTables]);

  const choose = (slot: 'row' | 'column' | 'label' | 'color', optionId: string) => {
    const option = options.find((item) => item.id === optionId) ?? null;
    setMissingLabels([]);
    setSetup(normalizeSetup({ ...activeSetup, [slot]: option }));
  };

  const saveTable = () => {
    const name = tableName.trim();
    if (!name) return;
    const existing = savedTables.find((table) => table.name === name);
    const id = existing?.id ?? newTableId();
    setSavedTables((current) =>
      existing
        ? current.map((table) => (table.id === id ? { ...table, ...axesOf(activeSetup) } : table))
        : [...current, { id, name, ...axesOf(activeSetup) }],
    );
    setSelectedId(id);
  };

  const renameTable = () => {
    const name = tableName.trim();
    if (!selectedId || !name) return;
    setSavedTables((current) => current.map((table) => (table.id === selectedId ? { ...table, name } : table)));
  };

  const duplicateTable = () => {
    const selected = savedTables.find((table) => table.id === selectedId);
    if (!selected) return;
    const copy = { ...selected, id: newTableId(), name: `${selected.name}${COPY_SUFFIX}` };
    setSavedTables((current) => [...current, copy]);
    setSelectedId(copy.id);
    setTableName(copy.name);
  };

  const deleteTable = () => {
    if (!selectedId) return;
    setSavedTables((current) => current.filter((table) => table.id !== selectedId));
    setSelectedId('');
    setTableName('');
  };

  const applySaved = (tableId: string) => {
    setSelectedId(tableId);
    const selected = savedTables.find((table) => table.id === tableId);
    if (!selected) return;
    const applied = reconcileSavedTable(selected, options);
    setMissingLabels(applied.missingLabels);
    setSetup(applied.setup);
    setTableName(selected.name);
  };

  return (
    <div className="pivot-table graph-table-panel graph-table-panel--main graph-table-panel--light">
      <form className="pivot-setup" onSubmit={(event) => event.preventDefault()}>
        <AxisSelect label="Rows" slot="row" setup={activeSetup} options={options} onChange={choose} />
        <AxisSelect label="Columns" slot="column" setup={activeSetup} options={options} onChange={choose} />
        <AxisSelect label="Label" slot="label" setup={activeSetup} options={options} onChange={choose} />
        <AxisSelect label="Color" slot="color" setup={activeSetup} options={options} onChange={choose} />
        <div className="pivot-saved">
          <select className="graph-drawer-input" aria-label="Saved tables" value={selectedId} onChange={(event) => applySaved(event.target.value)}>
            <option value="">Saved tables</option>
            {savedTables.map((table) => (
              <option key={table.id} value={table.id}>{table.name}</option>
            ))}
          </select>
          <input className="graph-drawer-input" aria-label="Table name" value={tableName} onChange={(event) => setTableName(event.target.value)} />
          <button type="button" className="graph-drawer-action" onClick={saveTable}><span className="graph-drawer-action-title">Save</span></button>
          <button type="button" className="graph-drawer-action" disabled={!selectedId} onClick={renameTable}><span className="graph-drawer-action-title">Rename</span></button>
          <button type="button" className="graph-drawer-action" disabled={!selectedId} onClick={duplicateTable}><span className="graph-drawer-action-title">Duplicate</span></button>
          <button type="button" className="graph-drawer-action" disabled={!selectedId} onClick={deleteTable}><span className="graph-drawer-action-title">Delete</span></button>
        </div>
      </form>
      {missingLabels.length > 0 ? (
        <p className="graph-table-message" role="status">
          Missing field: {missingLabels.join(', ')}. That axis was cleared.
        </p>
      ) : null}
      {status === 'loading' ? (
        <p className="graph-table-message" role="status">Loading…</p>
      ) : status === 'error' ? (
        <p className="graph-table-message graph-table-message-error" role="alert">
          {errorMessage ?? 'Unable to load the graph.'}
        </p>
      ) : model.status === 'ready' ? (
        <div ref={exportRootRef}>
          <TableLegend model={model} colorKey={activeSetup.color?.key ?? null} colorMap={colorMap} />
          <div className="graph-table-scroll">
            <table className="graph-table">
              <thead>
                <tr>
                  <th>{model.legendAxes.find((axis) => axis.role === 'Rows')?.label ?? ''}</th>
                  {model.columnLabels.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {model.rowLabels.map((row, rowIndex) => (
                  <tr key={row}>
                    <th scope="row">{row}</th>
                    {model.columnLabels.map((column, columnIndex) => (
                      <td key={column}>
                        <CellView cell={model.cells[rowIndex]?.[columnIndex]} colorKey={activeSetup.color?.key ?? null} colorMap={colorMap} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="graph-table-message" role="status">{model.message}</p>
      )}
    </div>
  );
}

function AxisSelect({
  label,
  slot,
  setup,
  options,
  onChange,
}: {
  label: string;
  slot: 'row' | 'column' | 'label' | 'color';
  setup: CustomTableSetup;
  options: AxisOption[];
  onChange: (slot: 'row' | 'column' | 'label' | 'color', optionId: string) => void;
}) {
  const choices = optionsForSlot(slot, setup, options);
  const current = setup[slot];
  return (
    <label className="pivot-setup-field">
      <span>{label}</span>
      <select
        className="graph-drawer-input"
        aria-label={label}
        value={current?.id ?? ''}
        disabled={choices.length === 0 && !current}
        onChange={(event) => onChange(slot, event.target.value)}
      >
        <option value="">None</option>
        {current && !choices.some((option) => option.id === current.id) ? (
          <option value={current.id}>{current.label}</option>
        ) : null}
        {choices.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function TableLegend({
  model,
  colorKey,
  colorMap,
}: {
  model: CustomTableModel;
  colorKey: string | null;
  colorMap?: Record<string, string>;
}) {
  return (
    <div className="pivot-legend">
      {model.legendAxes.map((axis) => (
        <span key={axis.role}>{axis.role}: {axis.label}</span>
      ))}
      {model.countCaption ? <span>{model.countCaption}</span> : null}
      {colorKey
        ? model.swatches.map((value) => (
            <span key={value} className="pivot-legend-swatch">
              <span className="pivot-legend-chip" style={{ background: nodeFillColorForValue(colorKey, value, colorMap) }} />
              {value}
            </span>
          ))
        : null}
    </div>
  );
}

function CellView({
  cell,
  colorKey,
  colorMap,
}: {
  cell: CustomTableModel['cells'][number][number] | undefined;
  colorKey: string | null;
  colorMap?: Record<string, string>;
}) {
  if (!cell) return null;
  if (cell.kind === 'count') return <span>{cell.value}</span>;
  return (
    <div className="pivot-badges">
      {cell.badges.map((badge) => (
        <span
          key={`${badge.text}:${badge.colorValue ?? ''}`}
          className="pivot-badge"
          style={{ background: badgeColor(colorKey, badge.colorValue, colorMap) }}
        >
          {badge.text}
        </span>
      ))}
    </div>
  );
}

function badgeColor(colorKey: string | null, colorValue: string | null, colorMap?: Record<string, string>): string {
  if (!colorKey || !colorValue) return PLAIN_BADGE_COLOR;
  if (colorValue === EMPTY_CUSTOM_VALUE) return MISSING_COLOR;
  return nodeFillColorForValue(colorKey, colorValue, colorMap);
}

function axesOf(setup: CustomTableSetup) {
  return { row: axisRef(setup.row), column: axisRef(setup.column), label: axisRef(setup.label), color: axisRef(setup.color) };
}

function newTableId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const EDGE_AXIS_DIRECTIONS = ['incoming', 'outgoing', 'any'] as const;

export type EdgeAxisDirection = (typeof EDGE_AXIS_DIRECTIONS)[number];

export type AxisKind = 'APPLICATION' | 'NODE' | 'NODE_REF' | 'EDGE';

export type AxisCatalogField = {
  key: string;
  label?: string;
  kind?: 'NODE' | 'NODE_REF' | 'EDGE';
};

export type AxisOption = {
  id: string;
  key: string;
  kind: AxisKind;
  direction: EdgeAxisDirection | null;
  label: string;
};

const APPLICATION_AXIS: AxisOption = {
  id: 'application',
  key: 'application',
  kind: 'APPLICATION',
  direction: null,
  label: 'Application',
};

const AXIS_LABEL_JOINER = ' — ';

const KIND_ID_PREFIX = {
  NODE: 'node',
  NODE_REF: 'noderef',
} as const;

function fieldLabel(field: AxisCatalogField): string {
  const trimmed = field.label?.trim();
  return trimmed ? trimmed : field.key;
}

function fieldKind(field: AxisCatalogField): 'NODE' | 'NODE_REF' | 'EDGE' {
  if (field.kind === 'NODE_REF' || field.kind === 'EDGE') return field.kind;
  return 'NODE';
}

function edgeOption(field: AxisCatalogField, direction: EdgeAxisDirection): AxisOption {
  const label = fieldLabel(field);
  return {
    id: `edge:${field.key}:${direction}`,
    key: field.key,
    kind: 'EDGE',
    direction,
    label: `${label}${AXIS_LABEL_JOINER}${direction}`,
  };
}

function nodeOption(field: AxisCatalogField, kind: 'NODE' | 'NODE_REF'): AxisOption {
  return {
    id: `${KIND_ID_PREFIX[kind]}:${field.key}`,
    key: field.key,
    kind,
    direction: null,
    label: fieldLabel(field),
  };
}

/** Dropdown choices for Create table, in Data Model order. Application is always first. */
export function buildAxisOptions(fields: readonly AxisCatalogField[]): AxisOption[] {
  const options: AxisOption[] = [APPLICATION_AXIS];
  for (const field of fields) {
    const kind = fieldKind(field);
    if (kind === 'EDGE') {
      for (const direction of EDGE_AXIS_DIRECTIONS) {
        options.push(edgeOption(field, direction));
      }
      continue;
    }
    options.push(nodeOption(field, kind));
  }
  return options;
}

export type CustomTableApp = {
  id: string;
  name: string;
  values: Record<string, string[]>;
};

export type CustomTableFlow = {
  id: string;
  sourceId: string;
  targetId: string;
  values: Record<string, string>;
};

export type CustomTableSetup = {
  row: AxisOption | null;
  column: AxisOption | null;
  label: AxisOption | null;
  color: AxisOption | null;
};

export type CustomTableBadge = {
  text: string;
  colorValue: string | null;
};

export type CustomTableCell =
  | { kind: 'badges'; badges: CustomTableBadge[] }
  | { kind: 'count'; value: number };

export type CustomTableLegendAxis = {
  role: 'Rows' | 'Columns' | 'Label' | 'Color';
  label: string;
};

export type CustomTableModel = {
  status: 'need-axis' | 'no-data' | 'too-large' | 'ready';
  rowLabels: string[];
  columnLabels: string[];
  cells: CustomTableCell[][];
  legendAxes: CustomTableLegendAxis[];
  swatches: string[];
  countCaption: 'number of flows' | 'number of applications' | null;
  message: string | null;
};

const EMPTY_CUSTOM_VALUE = '(Empty)';
const MAX_CUSTOM_TABLE_ROWS = 200;
const MAX_CUSTOM_TABLE_COLUMNS = 50;
const NEED_AXIS_MESSAGE = 'Choose a row or a column.';
const NO_DATA_MESSAGE = 'Nothing to display.';
const TOO_LARGE_MESSAGE = 'This table is too large. Filter the graph or choose a coarser dimension.';
const APPS_HEADER = 'Application';
const FLOW_COUNT_CAPTION = 'number of flows';
const APP_COUNT_CAPTION = 'number of applications';

type CountCaption = 'number of flows' | 'number of applications';

type TableMode = { kind: 'badges' } | { kind: 'count'; caption: CountCaption };

type CustomTableInput = {
  setup: CustomTableSetup;
  apps: readonly CustomTableApp[];
  flows: readonly CustomTableFlow[];
};

export function buildCustomTable(input: CustomTableInput): CustomTableModel {
  const { setup, apps, flows } = input;
  if (!setup.row && !setup.column) return blank('need-axis', NEED_AXIS_MESSAGE);

  const mode = resolveMode(setup);
  if (isEmptySource(setup, mode, apps, flows)) return blank('no-data', NO_DATA_MESSAGE);

  const filler = fillerHeader(setup, mode);
  const rowLabels = headersFor(setup.row, filler, apps, flows);
  const columnLabels = headersFor(setup.column, filler, apps, flows);
  const legendAxes = legendFor(setup, mode);
  const countCaption = mode.kind === 'count' ? mode.caption : null;
  if (rowLabels.length > MAX_CUSTOM_TABLE_ROWS || columnLabels.length > MAX_CUSTOM_TABLE_COLUMNS) {
    return { ...blank('too-large', TOO_LARGE_MESSAGE), legendAxes, countCaption };
  }

  const cells = rowLabels.map((rowLabel) =>
    columnLabels.map((columnLabel) => cellAt(input, mode, rowLabel, columnLabel)),
  );
  return {
    status: 'ready',
    rowLabels,
    columnLabels,
    cells,
    legendAxes,
    swatches: swatchesIn(cells),
    countCaption,
    message: null,
  };
}

function blank(status: CustomTableModel['status'], message: string): CustomTableModel {
  return {
    status,
    rowLabels: [],
    columnLabels: [],
    cells: [],
    legendAxes: [],
    swatches: [],
    countCaption: null,
    message,
  };
}

function resolveMode(setup: CustomTableSetup): TableMode {
  const axes = [setup.row, setup.column].filter((axis): axis is AxisOption => axis !== null);
  const edgeAxes = axes.filter((axis) => axis.kind === 'EDGE');
  if (edgeAxes.length === 0) return { kind: 'badges' };
  if (edgeAxes.length === 1) return { kind: 'count', caption: FLOW_COUNT_CAPTION };
  if (isSplitDirection(edgeAxes[0], edgeAxes[1])) {
    return setup.label ? { kind: 'badges' } : { kind: 'count', caption: APP_COUNT_CAPTION };
  }
  return setup.label ? { kind: 'badges' } : { kind: 'count', caption: FLOW_COUNT_CAPTION };
}

function isSplitDirection(left: AxisOption, right: AxisOption): boolean {
  const directions = [left.direction, right.direction];
  return directions.includes('incoming') && directions.includes('outgoing');
}

function isEmptySource(
  setup: CustomTableSetup,
  mode: TableMode,
  apps: readonly CustomTableApp[],
  flows: readonly CustomTableFlow[],
): boolean {
  const axes = [setup.row, setup.column].filter((axis): axis is AxisOption => axis !== null);
  const usesApps = mode.kind === 'badges' || axes.some((axis) => axis.kind !== 'EDGE');
  if (usesApps && apps.length === 0) return true;
  const usesFlows = axes.some((axis) => axis.kind === 'EDGE');
  return usesFlows && flows.length === 0;
}

function fillerHeader(setup: CustomTableSetup, mode: TableMode): string {
  if (mode.kind === 'count') return mode.caption;
  if (setup.label && setup.label.kind !== 'EDGE') return setup.label.label;
  return APPS_HEADER;
}

function headersFor(
  axis: AxisOption | null,
  filler: string,
  apps: readonly CustomTableApp[],
  flows: readonly CustomTableFlow[],
): string[] {
  if (!axis) return [filler];
  if (axis.kind === 'APPLICATION') return uniqueSorted(apps.map((app) => app.name));
  if (axis.kind === 'EDGE') return uniqueSorted(flows.map((flow) => flowValue(flow, axis.key)));
  return uniqueSorted(apps.flatMap((app) => valuesOf(app, axis.key)));
}

function cellAt(input: CustomTableInput, mode: TableMode, rowLabel: string, columnLabel: string): CustomTableCell {
  if (mode.kind === 'count') return { kind: 'count', value: countAt(input, rowLabel, columnLabel) };
  return { kind: 'badges', badges: badgesFor(matchedApps(input, rowLabel, columnLabel), input.setup) };
}

function countAt(input: CustomTableInput, rowLabel: string, columnLabel: string): number {
  const { setup } = input;
  const edgeAxes = [setup.row, setup.column].filter((axis): axis is AxisOption => axis?.kind === 'EDGE');
  if (edgeAxes.length === 2 && isSplitDirection(edgeAxes[0], edgeAxes[1])) {
    return appsForSplit(input, rowLabel, columnLabel).length;
  }
  if (edgeAxes.length === 2) return sameFlowIds(input, rowLabel, columnLabel).size;
  return singleEdgeIds(input, rowLabel, columnLabel).size;
}

function matchedApps(input: CustomTableInput, rowLabel: string, columnLabel: string): CustomTableApp[] {
  const { setup } = input;
  const edgeAxes = [setup.row, setup.column].filter((axis): axis is AxisOption => axis?.kind === 'EDGE');
  if (edgeAxes.length === 2 && isSplitDirection(edgeAxes[0], edgeAxes[1])) {
    return appsForSplit(input, rowLabel, columnLabel);
  }
  if (edgeAxes.length === 2) return appsForSameFlow(input, rowLabel, columnLabel);
  return intersectApps(
    appsForHeader(setup.row, rowLabel, input.apps),
    appsForHeader(setup.column, columnLabel, input.apps),
  );
}

function singleEdgeIds(input: CustomTableInput, rowLabel: string, columnLabel: string): Set<string> {
  const { setup, apps, flows } = input;
  const edgeOnRow = setup.row?.kind === 'EDGE';
  const edgeAxis = edgeOnRow ? setup.row : setup.column;
  const groupAxis = edgeOnRow ? setup.column : setup.row;
  const edgeHeader = edgeOnRow ? rowLabel : columnLabel;
  const groupHeader = edgeOnRow ? columnLabel : rowLabel;
  if (!edgeAxis) return new Set();
  const groupIds = groupAxis ? new Set(appsForHeader(groupAxis, groupHeader, apps).map((app) => app.id)) : null;
  const ids = new Set<string>();
  for (const flow of flows) {
    if (flowValue(flow, edgeAxis.key) !== edgeHeader) continue;
    if (groupIds && !endpoints(flow, edgeAxis.direction).some((id) => groupIds.has(id))) continue;
    ids.add(flow.id);
  }
  return ids;
}

function sameFlowIds(input: CustomTableInput, rowLabel: string, columnLabel: string): Set<string> {
  const { setup, flows } = input;
  const ids = new Set<string>();
  if (!setup.row || !setup.column) return ids;
  for (const flow of flows) {
    if (flowValue(flow, setup.row.key) !== rowLabel) continue;
    if (flowValue(flow, setup.column.key) !== columnLabel) continue;
    ids.add(flow.id);
  }
  return ids;
}

function appsForSameFlow(input: CustomTableInput, rowLabel: string, columnLabel: string): CustomTableApp[] {
  const { setup, apps, flows } = input;
  if (!setup.row || !setup.column) return [];
  return apps.filter((app) =>
    flows.some(
      (flow) =>
        flowValue(flow, setup.row!.key) === rowLabel &&
        flowValue(flow, setup.column!.key) === columnLabel &&
        appOnFlow(app.id, flow, setup.row!.direction) &&
        appOnFlow(app.id, flow, setup.column!.direction),
    ),
  );
}

function appsForSplit(input: CustomTableInput, rowLabel: string, columnLabel: string): CustomTableApp[] {
  const { setup, apps, flows } = input;
  if (!setup.row || !setup.column) return [];
  return apps.filter(
    (app) =>
      hasDirectedFlow(app.id, setup.row!, rowLabel, flows) &&
      hasDirectedFlow(app.id, setup.column!, columnLabel, flows),
  );
}

function hasDirectedFlow(
  appId: string,
  axis: AxisOption,
  header: string,
  flows: readonly CustomTableFlow[],
): boolean {
  return flows.some((flow) => flowValue(flow, axis.key) === header && appOnFlow(appId, flow, axis.direction));
}

function appsForHeader(
  axis: AxisOption | null,
  header: string,
  apps: readonly CustomTableApp[],
): CustomTableApp[] {
  if (!axis || axis.kind === 'EDGE') return [...apps];
  if (axis.kind === 'APPLICATION') return apps.filter((app) => app.name === header);
  return apps.filter((app) => valuesOf(app, axis.key).includes(header));
}

function intersectApps(left: readonly CustomTableApp[], right: readonly CustomTableApp[]): CustomTableApp[] {
  const ids = new Set(right.map((app) => app.id));
  return left.filter((app) => ids.has(app.id));
}

function badgesFor(matched: readonly CustomTableApp[], setup: CustomTableSetup): CustomTableBadge[] {
  const label = setup.label && setup.label.kind !== 'EDGE' ? setup.label : null;
  const color = setup.color && setup.color.kind !== 'EDGE' && setup.color.kind !== 'APPLICATION' ? setup.color : null;
  const seen = new Set<string>();
  const badges: CustomTableBadge[] = [];
  const ordered = [...matched].sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  for (const app of ordered) {
    const texts = label && label.kind !== 'APPLICATION' ? valuesOf(app, label.key) : [app.name];
    const colors = color ? valuesOf(app, color.key) : [null];
    for (const text of texts) {
      for (const colorValue of colors) {
        const stamp = `${text}\0${colorValue ?? ''}`;
        if (seen.has(stamp)) continue;
        seen.add(stamp);
        badges.push({ text, colorValue });
      }
    }
  }
  badges.sort(
    (left, right) => left.text.localeCompare(right.text) || (left.colorValue ?? '').localeCompare(right.colorValue ?? ''),
  );
  return badges;
}

function legendFor(setup: CustomTableSetup, mode: TableMode): CustomTableLegendAxis[] {
  const axes: CustomTableLegendAxis[] = [];
  if (setup.row) axes.push({ role: 'Rows', label: setup.row.label });
  if (setup.column) axes.push({ role: 'Columns', label: setup.column.label });
  if (mode.kind === 'badges' && setup.label) axes.push({ role: 'Label', label: setup.label.label });
  if (mode.kind === 'badges' && setup.color && setup.color.kind !== 'EDGE' && setup.color.kind !== 'APPLICATION') {
    axes.push({ role: 'Color', label: setup.color.label });
  }
  return axes;
}

function swatchesIn(cells: CustomTableCell[][]): string[] {
  const values = new Set<string>();
  for (const row of cells) {
    for (const cell of row) {
      if (cell.kind !== 'badges') continue;
      for (const badge of cell.badges) {
        if (badge.colorValue) values.add(badge.colorValue);
      }
    }
  }
  return uniqueSorted([...values]);
}

function endpoints(flow: CustomTableFlow, direction: EdgeAxisDirection | null): string[] {
  if (direction === 'incoming') return [flow.targetId];
  if (direction === 'outgoing') return [flow.sourceId];
  return [flow.sourceId, flow.targetId];
}

function appOnFlow(appId: string, flow: CustomTableFlow, direction: EdgeAxisDirection | null): boolean {
  return endpoints(flow, direction).includes(appId);
}

function valuesOf(app: CustomTableApp, key: string): string[] {
  const values = (app.values[key] ?? []).map((value) => value.trim()).filter(Boolean);
  return values.length > 0 ? values : [EMPTY_CUSTOM_VALUE];
}

function flowValue(flow: CustomTableFlow, key: string): string {
  const value = flow.values[key]?.trim();
  return value ? value : EMPTY_CUSTOM_VALUE;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => {
    if (left === EMPTY_CUSTOM_VALUE) return 1;
    if (right === EMPTY_CUSTOM_VALUE) return -1;
    return left.localeCompare(right);
  });
}

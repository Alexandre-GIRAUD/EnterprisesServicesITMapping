export const EMPTY_PIVOT_VALUE = '(Empty)';

export type PivotDimensionKind = 'NODE' | 'NODE_REF';

export type PivotDimension = {
  key: string;
  kind: PivotDimensionKind;
};

export type PivotSetup = {
  rowKey: string;
  columnKey: string;
  labelKey: string | null;
  colorKey: string | null;
};

export type PivotApp = {
  id: string;
  name: string;
  values: Record<string, string[]>;
};

export type PivotBadge = {
  appId: string;
  text: string;
  colorValue: string | null;
};

export type PivotModel = {
  rowLabels: string[];
  columnLabels: string[];
  cells: PivotBadge[][][];
};

type GraphApp = {
  id: string;
  label: string;
  type: string;
  properties?: Record<string, string>;
};

type CatalogApp = {
  id: string;
  nodeAttributes?: Record<string, string>;
  nodeRefs?: Record<string, Array<{ id: string; name?: string; value?: string }>>;
};

export function collectPivotApps(
  nodes: readonly GraphApp[],
  catalog: readonly CatalogApp[],
  dimensions: readonly PivotDimension[],
): PivotApp[] {
  const catalogById = new Map(catalog.map((app) => [app.id, app]));
  return nodes
    .filter((node) => node.type === 'Application')
    .map((node) => {
      const detail = catalogById.get(node.id);
      const values: Record<string, string[]> = {};
      for (const dimension of dimensions) {
        values[dimension.key] = readValues(node, detail, dimension);
      }
      return { id: node.id, name: node.label || node.id, values };
    });
}

export function buildPivotTable(apps: readonly PivotApp[], setup: PivotSetup): PivotModel {
  const rowLabels = sortedLabels(apps, setup.rowKey);
  const columnLabels = sortedLabels(apps, setup.columnKey);
  const cells = rowLabels.map((rowLabel) =>
    columnLabels.map((columnLabel) => badgesFor(apps, setup, rowLabel, columnLabel)),
  );
  return { rowLabels, columnLabels, cells };
}

function readValues(node: GraphApp, detail: CatalogApp | undefined, dimension: PivotDimension): string[] {
  if (dimension.kind === 'NODE_REF') {
    const refs = detail?.nodeRefs?.[dimension.key] ?? [];
    return refs
      .map((ref) => ref.name?.trim() || ref.value?.trim() || ref.id)
      .filter((value): value is string => Boolean(value));
  }
  const fromNode = node.properties?.[dimension.key]?.trim();
  const fromCatalog = detail?.nodeAttributes?.[dimension.key]?.trim();
  const value = fromNode || fromCatalog || '';
  return value ? [value] : [];
}

function axisValues(app: PivotApp, key: string): string[] {
  const values = (app.values[key] ?? []).map((value) => value.trim()).filter(Boolean);
  return values.length > 0 ? values : [EMPTY_PIVOT_VALUE];
}

function sortedLabels(apps: readonly PivotApp[], key: string): string[] {
  const labels = new Set<string>();
  for (const app of apps) {
    for (const value of axisValues(app, key)) labels.add(value);
  }
  return [...labels].sort((left, right) => {
    if (left === EMPTY_PIVOT_VALUE) return 1;
    if (right === EMPTY_PIVOT_VALUE) return -1;
    return left.localeCompare(right);
  });
}

function badgesFor(
  apps: readonly PivotApp[],
  setup: PivotSetup,
  rowLabel: string,
  columnLabel: string,
): PivotBadge[] {
  const badges: PivotBadge[] = [];
  for (const app of apps) {
    const rows = axisValues(app, setup.rowKey);
    const columns = axisValues(app, setup.columnKey);
    if (!rows.includes(rowLabel) || !columns.includes(columnLabel)) continue;
    badges.push({
      appId: app.id,
      text: labelText(app, setup.labelKey),
      colorValue: setup.colorKey ? colorText(app, setup.colorKey) : null,
    });
  }
  return badges.sort((left, right) => left.text.localeCompare(right.text) || left.appId.localeCompare(right.appId));
}

function labelText(app: PivotApp, labelKey: string | null): string {
  if (!labelKey) return app.name;
  const values = (app.values[labelKey] ?? []).map((value) => value.trim()).filter(Boolean);
  return values.length > 0 ? values.join(', ') : EMPTY_PIVOT_VALUE;
}

function colorText(app: PivotApp, colorKey: string): string | null {
  const values = (app.values[colorKey] ?? []).map((value) => value.trim()).filter(Boolean);
  return values[0] ?? null;
}

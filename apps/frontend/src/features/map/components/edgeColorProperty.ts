import type { GraphEdgeDto, GraphNodeDto } from '@/types/api';
import {
  EDGE_TYPE_STYLES,
  edgeColorForProperty,
  legendLabelForData,
  nodeColorForType,
  sortDataTypesForLegend,
  type EdgeTypeKey,
} from './graphTheme';

/** Sentinel: paint by relationship / flow type. */
export const RELATION_TYPE_COLOR_KEY = '__relation__';
/** Sentinel: paint by app / node type. */
export const NODE_TYPE_COLOR_KEY = '__type__';

export const EDGE_COLOR_PROPERTY_STORAGE_KEY = 'flowra.graph.edgeColorProperty';
export const EDGE_LABEL_PROPERTY_STORAGE_KEY = 'flowra.graph.edgeLabelProperty';
export const APP_FILL_PROPERTY_STORAGE_KEY = 'flowra.graph.appFillProperty';
export const APP_BORDER_PROPERTY_STORAGE_KEY = 'flowra.graph.appBorderProperty';
export const LEGEND_COLORS_STORAGE_KEY = 'flowra.graph.legendColors';
export const LEGEND_SETUPS_STORAGE_KEY = 'flowra.graph.legendSetups';
export const HIDE_EDGE_LABELS_STORAGE_KEY = 'flowra.graph.hideEdgeLabels';

const KNOWN_PROPERTY_ORDER = ['data', 'connection_kind', 'asset_class', 'frequency', 'creation_date'] as const;
const INTERNAL_PROPERTY_KEYS = new Set(['validFrom', 'validTo', 'id', 'name', 'description', 'year']);

export const EDGE_COLOR_PROPERTY_LABELS: Record<string, string> = {
  data: 'Exchanged data',
  connection_kind: 'Integration kind',
  asset_class: 'Asset class',
  frequency: 'Frequency',
  creation_date: 'Creation year',
  [RELATION_TYPE_COLOR_KEY]: 'Flow',
  [NODE_TYPE_COLOR_KEY]: 'App',
};

export type AttributeOption = { key: string; label: string };

export type LegendColorMaps = {
  edgeStroke?: Record<string, string>;
  edgeLabel?: Record<string, string>;
  appFill?: Record<string, string>;
  appBorder?: Record<string, string>;
};

export type LegendCodingKeys = {
  edgeColorKey: string;
  edgeLabelKey: string;
  appFillKey: string;
  appBorderKey: string;
};

export type LegendSetup = LegendCodingKeys & {
  id: string;
  name: string;
  colors: LegendColorMaps;
  hideEdgeLabels?: boolean;
};

/** Snapshot of active legend coding (pin view / apply view). */
export type GraphLegendSnapshot = LegendCodingKeys & {
  colors?: LegendColorMaps;
  hideEdgeLabels?: boolean;
};

export function labelForColorProperty(key: string): string {
  return EDGE_COLOR_PROPERTY_LABELS[key] ?? key.replace(/_/g, ' ');
}

function loadStoredKey(storageKey: string, fallback: string): string {
  try {
    return localStorage.getItem(storageKey) ?? fallback;
  } catch {
    return fallback;
  }
}

function storeKey(storageKey: string, key: string): void {
  try {
    localStorage.setItem(storageKey, key);
  } catch {
    /* ignore */
  }
}

export function loadStoredColorPropertyKey(): string {
  return loadStoredKey(EDGE_COLOR_PROPERTY_STORAGE_KEY, RELATION_TYPE_COLOR_KEY);
}

export function storeColorPropertyKey(key: string): void {
  storeKey(EDGE_COLOR_PROPERTY_STORAGE_KEY, key);
}

export function loadStoredLabelPropertyKey(): string {
  return loadStoredKey(EDGE_LABEL_PROPERTY_STORAGE_KEY, 'data');
}

export function storeLabelPropertyKey(key: string): void {
  storeKey(EDGE_LABEL_PROPERTY_STORAGE_KEY, key);
}

export function loadStoredAppFillKey(): string {
  return loadStoredKey(APP_FILL_PROPERTY_STORAGE_KEY, NODE_TYPE_COLOR_KEY);
}

export function storeAppFillKey(key: string): void {
  storeKey(APP_FILL_PROPERTY_STORAGE_KEY, key);
}

export function loadStoredAppBorderKey(): string {
  return loadStoredKey(APP_BORDER_PROPERTY_STORAGE_KEY, NODE_TYPE_COLOR_KEY);
}

export function storeAppBorderKey(key: string): void {
  storeKey(APP_BORDER_PROPERTY_STORAGE_KEY, key);
}

export function loadLegendColorMaps(): LegendColorMaps {
  try {
    const raw = localStorage.getItem(LEGEND_COLORS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as LegendColorMaps;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function storeLegendColorMaps(colors: LegendColorMaps): void {
  try {
    localStorage.setItem(LEGEND_COLORS_STORAGE_KEY, JSON.stringify(colors));
  } catch {
    /* ignore */
  }
}

export function loadHideEdgeLabels(): boolean {
  try {
    return localStorage.getItem(HIDE_EDGE_LABELS_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function storeHideEdgeLabels(hide: boolean): void {
  try {
    localStorage.setItem(HIDE_EDGE_LABELS_STORAGE_KEY, hide ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** Slightly darker shade of a CSS hex/rgb color (~18%). */
export function darkenColor(color: string, amount = 0.18): string {
  const rgb = parseCssColor(color);
  if (!rgb) return color;
  const f = 1 - amount;
  const r = Math.max(0, Math.min(255, Math.round(rgb.r * f)));
  const g = Math.max(0, Math.min(255, Math.round(rgb.g * f)));
  const b = Math.max(0, Math.min(255, Math.round(rgb.b * f)));
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function toHex(n: number): string {
  return n.toString(16).padStart(2, '0');
}

function parseCssColor(color: string): { r: number; g: number; b: number } | null {
  const hex = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    };
  }
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    return {
      r: parseInt(hex[1]! + hex[1]!, 16),
      g: parseInt(hex[2]! + hex[2]!, 16),
      b: parseInt(hex[3]! + hex[3]!, 16),
    };
  }
  const m = hex.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) {
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
  }
  return null;
}

export function loadLegendSetups(): LegendSetup[] {
  try {
    const raw = localStorage.getItem(LEGEND_SETUPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LegendSetup[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function storeLegendSetups(setups: LegendSetup[]): void {
  try {
    localStorage.setItem(LEGEND_SETUPS_STORAGE_KEY, JSON.stringify(setups));
  } catch {
    /* ignore */
  }
}

/** Visible apps/edges after filters (+ hide). Read-only slice. */
export function visibleGraphElements(
  graphNodes: GraphNodeDto[],
  graphEdges: GraphEdgeDto[],
  hiddenNodeIds: ReadonlySet<string> = new Set()
): { nodes: GraphNodeDto[]; edges: GraphEdgeDto[] } {
  const nodes = graphNodes.filter((n) => !hiddenNodeIds.has(n.id));
  const visible = new Set(nodes.map((n) => n.id));
  const edges = graphEdges.filter(
    (e) => visible.has(e.sourceId) && visible.has(e.targetId)
  );
  return { nodes, edges };
}

/** True when no business attrs exist on visible elements — only App / Flow sentinels. */
export function isSimpleLegendMode(
  visibleNodes: GraphNodeDto[],
  visibleEdges: GraphEdgeDto[]
): boolean {
  return (
    discoverColorPropertyKeys(visibleEdges).length === 0 &&
    discoverNodePropertyKeys(visibleNodes).length === 0
  );
}

/** Read-only: value used for stroke / label for one edge. Never writes. */
export function edgeColorValue(edge: GraphEdgeDto, propertyKey: string): string | null {
  if (propertyKey === RELATION_TYPE_COLOR_KEY) {
    return edge.type?.trim() || null;
  }
  const fromProps = edge.properties?.[propertyKey];
  if (fromProps != null && String(fromProps).trim()) {
    return String(fromProps).trim();
  }
  if (propertyKey === 'data' && edge.data?.trim()) {
    return edge.data.trim();
  }
  return null;
}

export function edgeLabelText(edge: GraphEdgeDto, propertyKey: string): string {
  return edgeColorValue(edge, propertyKey)?.trim() || edge.type?.trim() || 'DEPENDS_ON';
}

function presentKeysFromProps(
  items: ReadonlyArray<{ readonly properties?: Readonly<Record<string, string>> | null }>
): Set<string> {
  const keys = new Set<string>();
  for (const item of items) {
    if (!item.properties) continue;
    for (const [key, value] of Object.entries(item.properties)) {
      if (INTERNAL_PROPERTY_KEYS.has(key)) continue;
      if (value != null && String(value).trim()) keys.add(key);
    }
  }
  return keys;
}

function orderKeys(keys: string[]): string[] {
  const known = KNOWN_PROPERTY_ORDER.filter((k) => keys.includes(k));
  const rest = keys
    .filter((k) => !KNOWN_PROPERTY_ORDER.includes(k as (typeof KNOWN_PROPERTY_ORDER)[number]))
    .sort();
  return [...known, ...rest];
}

export function discoverColorPropertyKeys(edges: GraphEdgeDto[]): string[] {
  const keys = presentKeysFromProps(edges);
  for (const edge of edges) {
    if (edge.data?.trim()) keys.add('data');
  }
  return orderKeys([...keys]);
}

export function colorPropertyOptions(edges: GraphEdgeDto[]): AttributeOption[] {
  const options = discoverColorPropertyKeys(edges).map((key) => ({
    key,
    label: labelForColorProperty(key),
  }));
  options.push({
    key: RELATION_TYPE_COLOR_KEY,
    label: labelForColorProperty(RELATION_TYPE_COLOR_KEY),
  });
  return options;
}

export function resolveColorPropertyKey(storedKey: string, edges: GraphEdgeDto[]): string {
  const options = colorPropertyOptions(edges);
  if (options.some((o) => o.key === storedKey)) return storedKey;
  return options[0]?.key ?? RELATION_TYPE_COLOR_KEY;
}

export function discoverNodePropertyKeys(nodes: GraphNodeDto[]): string[] {
  return orderKeys([...presentKeysFromProps(nodes)]);
}

export function nodePropertyOptions(nodes: GraphNodeDto[]): AttributeOption[] {
  const options = discoverNodePropertyKeys(nodes).map((key) => ({
    key,
    label: labelForColorProperty(key),
  }));
  options.push({
    key: NODE_TYPE_COLOR_KEY,
    label: labelForColorProperty(NODE_TYPE_COLOR_KEY),
  });
  return options;
}

export function resolveNodePropertyKey(storedKey: string, nodes: GraphNodeDto[]): string {
  const options = nodePropertyOptions(nodes);
  if (options.some((o) => o.key === storedKey)) return storedKey;
  return options[0]?.key ?? NODE_TYPE_COLOR_KEY;
}

export function nodePropValue(node: GraphNodeDto, propertyKey: string): string | null {
  if (propertyKey === NODE_TYPE_COLOR_KEY) {
    return node.type?.trim() || null;
  }
  const fromProps = node.properties?.[propertyKey];
  if (fromProps != null && String(fromProps).trim()) {
    return String(fromProps).trim();
  }
  return null;
}

function overrideOr(
  map: Record<string, string> | undefined,
  value: string | null | undefined,
  fallback: string
): string {
  if (value && map?.[value]) return map[value];
  return fallback;
}

/** Default edge stroke (no custom override). */
export function defaultEdgeStrokeColor(
  value: string | null,
  relationType: string,
  propertyKey: string
): string {
  return edgeColorForProperty(value, relationType, propertyKey);
}

export function paintEdgeStrokeColor(
  value: string | null,
  relationType: string,
  propertyKey: string,
  colorMap?: Record<string, string>
): string {
  const fallback = defaultEdgeStrokeColor(value, relationType, propertyKey);
  return overrideOr(colorMap, value, fallback);
}

export function paintEdgeLabelColor(
  value: string | null,
  relationType: string,
  propertyKey: string,
  colorMap?: Record<string, string>,
  strokeFallback?: string
): string {
  if (value && colorMap?.[value]) return colorMap[value];
  if (strokeFallback) return strokeFallback;
  return defaultEdgeStrokeColor(value, relationType, propertyKey);
}

/**
 * When stroke + label share the same attribute, use one color (stroke) for both.
 */
export function resolveSharedEdgeLabelColor(
  colorKey: string,
  labelKey: string,
  labelValue: string | null,
  relationType: string,
  colors: LegendColorMaps | undefined,
  strokeColor: string
): string {
  if (colorKey === labelKey) return strokeColor;
  return paintEdgeLabelColor(
    labelValue,
    relationType,
    labelKey,
    colors?.edgeLabel,
    strokeColor
  );
}

export function nodeFillColor(
  node: GraphNodeDto,
  propertyKey: string,
  colorMap?: Record<string, string>
): string {
  if (propertyKey === NODE_TYPE_COLOR_KEY) {
    const value = nodePropValue(node, propertyKey);
    return overrideOr(colorMap, value, '#ffffff');
  }
  const value = nodePropValue(node, propertyKey);
  if (!value) return '#ffffff';
  const fallback = edgeColorForProperty(value, node.type || 'Application', propertyKey);
  return overrideOr(colorMap, value, fallback);
}

/**
 * Border color. When {@link fillKey} equals border key, border is a darker shade of fill
 * (except default App/type sentinel with no custom fill → keep type border color).
 */
export function nodeBorderColor(
  node: GraphNodeDto,
  propertyKey: string,
  colorMap?: Record<string, string>,
  fillKey?: string,
  fillColorMap?: Record<string, string>
): string {
  if (fillKey && fillKey === propertyKey) {
    const value = nodePropValue(node, fillKey);
    const fill = nodeFillColor(node, fillKey, fillColorMap);
    const hasCustom = Boolean(value && fillColorMap?.[value]);
    if (fillKey === NODE_TYPE_COLOR_KEY && !hasCustom) {
      return nodeColorForType(node.type);
    }
    return darkenColor(fill);
  }
  if (propertyKey === NODE_TYPE_COLOR_KEY) {
    const value = nodePropValue(node, propertyKey);
    const fallback = nodeColorForType(node.type);
    return overrideOr(colorMap, value, fallback);
  }
  const value = nodePropValue(node, propertyKey);
  if (!value) return nodeColorForType(node.type);
  const fallback = edgeColorForProperty(value, node.type || 'Application', propertyKey);
  return overrideOr(colorMap, value, fallback);
}

export function nodeFillColorForValue(
  propertyKey: string,
  value: string,
  colorMap?: Record<string, string>
): string {
  if (propertyKey === NODE_TYPE_COLOR_KEY) {
    return overrideOr(colorMap, value, '#ffffff');
  }
  const fallback = edgeColorForProperty(value, 'Application', propertyKey);
  return overrideOr(colorMap, value, fallback);
}

export function nodeBorderColorForValue(
  propertyKey: string,
  value: string,
  colorMap?: Record<string, string>,
  fillKey?: string,
  fillColorMap?: Record<string, string>
): string {
  if (fillKey && fillKey === propertyKey) {
    const fill = nodeFillColorForValue(fillKey, value, fillColorMap);
    const hasCustom = Boolean(fillColorMap?.[value]);
    if (fillKey === NODE_TYPE_COLOR_KEY && !hasCustom) {
      return nodeColorForType(value);
    }
    return darkenColor(fill);
  }
  if (propertyKey === NODE_TYPE_COLOR_KEY) {
    return overrideOr(colorMap, value, nodeColorForType(value));
  }
  const fallback = edgeColorForProperty(value, 'Application', propertyKey);
  return overrideOr(colorMap, value, fallback);
}

/** Persist a color for a channel; mirror stroke↔label or fill→(derived border) when shared. */
export function setRationalizedColorInMaps(
  colors: LegendColorMaps,
  channel: keyof LegendColorMaps,
  value: string,
  color: string,
  edgeColorKey: string,
  edgeLabelKey: string,
  appFillKey: string,
  appBorderKey: string
): LegendColorMaps {
  let next = setColorInMaps(colors, channel, value, color);
  if (
    (channel === 'edgeStroke' || channel === 'edgeLabel') &&
    edgeColorKey === edgeLabelKey
  ) {
    next = setColorInMaps(next, 'edgeStroke', value, color);
    next = setColorInMaps(next, 'edgeLabel', value, color);
  }
  if (channel === 'appFill' && appFillKey === appBorderKey) {
    next = setColorInMaps(next, 'appFill', value, color);
    // border derived at paint time — clear stale explicit border override
    if (next.appBorder?.[value]) {
      const { [value]: _, ...rest } = next.appBorder;
      next = { ...next, appBorder: rest };
    }
  }
  return next;
}

export function collectLegendColorValues(
  edges: GraphEdgeDto[],
  propertyKey: string
): string[] {
  const values = edges
    .map((e) => edgeColorValue(e, propertyKey))
    .filter((v): v is string => Boolean(v?.trim()));

  if (propertyKey === 'data' || propertyKey === 'connection_kind') {
    return sortDataTypesForLegend(values);
  }
  if (propertyKey === RELATION_TYPE_COLOR_KEY) {
    const order = Object.keys(EDGE_TYPE_STYLES) as EdgeTypeKey[];
    const present = new Set(values);
    const known = order.filter((k) => present.has(k));
    const unknown = [...present].filter((k) => !order.includes(k as EdgeTypeKey)).sort();
    return [...known, ...unknown];
  }
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function collectNodeLegendValues(
  nodes: GraphNodeDto[],
  propertyKey: string
): string[] {
  if (propertyKey === NODE_TYPE_COLOR_KEY) {
    return [...new Set(nodes.map((n) => n.type).filter(Boolean))].sort();
  }
  const values = nodes
    .map((n) => nodePropValue(n, propertyKey))
    .filter((v): v is string => Boolean(v?.trim()));
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function legendLabelForColorValue(propertyKey: string, value: string): string {
  if (propertyKey === 'data' || propertyKey === 'connection_kind') return legendLabelForData(value);
  if (propertyKey === RELATION_TYPE_COLOR_KEY) {
    return (EDGE_TYPE_STYLES as Record<string, { legendLabel: string } | undefined>)[value]
      ?.legendLabel ?? value;
  }
  if (propertyKey === NODE_TYPE_COLOR_KEY) {
    return value === 'Application' ? 'App' : value;
  }
  return value;
}

export function strokeColorForLegendSwatch(
  propertyKey: string,
  value: string,
  relationFallback = 'DEPENDS_ON',
  colorMap?: Record<string, string>
): string {
  return paintEdgeStrokeColor(value, relationFallback, propertyKey, colorMap);
}

export function setColorInMaps(
  colors: LegendColorMaps,
  channel: keyof LegendColorMaps,
  value: string,
  color: string
): LegendColorMaps {
  const prev = colors[channel] ?? {};
  return {
    ...colors,
    [channel]: { ...prev, [value]: color },
  };
}

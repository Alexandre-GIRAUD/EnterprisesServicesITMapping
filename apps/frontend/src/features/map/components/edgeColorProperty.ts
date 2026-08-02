import type { GraphEdgeDto, GraphNodeDto } from '@/types/api';
import {
  EDGE_TYPE_STYLES,
  edgeColorForProperty,
  legendLabelForData,
  nodeColorForType,
  sortDataTypesForLegend,
  type EdgeTypeKey,
} from './graphTheme';

/** Sentinel key: color/label edges by Neo4j relationship type. */
export const RELATION_TYPE_COLOR_KEY = '__relation__';
/** Sentinel key: paint apps by node type (default border / white fill). */
export const NODE_TYPE_COLOR_KEY = '__type__';

export const EDGE_COLOR_PROPERTY_STORAGE_KEY = 'flowra.graph.edgeColorProperty';
export const EDGE_LABEL_PROPERTY_STORAGE_KEY = 'flowra.graph.edgeLabelProperty';
export const APP_FILL_PROPERTY_STORAGE_KEY = 'flowra.graph.appFillProperty';
export const APP_BORDER_PROPERTY_STORAGE_KEY = 'flowra.graph.appBorderProperty';

const KNOWN_PROPERTY_ORDER = ['data', 'connection_kind', 'asset_class', 'frequency', 'creation_date'] as const;
const INTERNAL_PROPERTY_KEYS = new Set(['validFrom', 'validTo', 'id', 'name', 'description', 'year']);

export const EDGE_COLOR_PROPERTY_LABELS: Record<string, string> = {
  data: 'Exchanged data',
  connection_kind: 'Integration kind',
  asset_class: 'Asset class',
  frequency: 'Frequency',
  creation_date: 'Creation year',
  [RELATION_TYPE_COLOR_KEY]: 'Relationship type',
  [NODE_TYPE_COLOR_KEY]: 'Node type',
};

export type AttributeOption = { key: string; label: string };

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
  return loadStoredKey(EDGE_COLOR_PROPERTY_STORAGE_KEY, 'data');
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

/** Display label text derived from an existing edge field (fallback: relation type). */
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

/** Property keys with ≥1 non-empty value on the given edges (+ `data`). */
export function discoverColorPropertyKeys(edges: GraphEdgeDto[]): string[] {
  const keys = presentKeysFromProps(edges);
  for (const edge of edges) {
    if (edge.data?.trim()) keys.add('data');
  }
  return orderKeys([...keys]);
}

/** Selector options for edges: discovered properties + relationship type. */
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
  return options[0]?.key ?? 'data';
}

/** Property keys with ≥1 non-empty value on the given apps. */
export function discoverNodePropertyKeys(nodes: GraphNodeDto[]): string[] {
  return orderKeys([...presentKeysFromProps(nodes)]);
}

/** Selector options for apps: discovered properties + node type. */
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

/** Read-only node property value. Never writes. */
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

/** CSS fill only (derived from existing attributes). */
export function nodeFillColor(node: GraphNodeDto, propertyKey: string): string {
  if (propertyKey === NODE_TYPE_COLOR_KEY) return '#ffffff';
  const value = nodePropValue(node, propertyKey);
  if (!value) return '#ffffff';
  return edgeColorForProperty(value, node.type || 'Application', propertyKey);
}

/** CSS border only (derived from existing attributes). */
export function nodeBorderColor(node: GraphNodeDto, propertyKey: string): string {
  if (propertyKey === NODE_TYPE_COLOR_KEY) return nodeColorForType(node.type);
  const value = nodePropValue(node, propertyKey);
  if (!value) return nodeColorForType(node.type);
  return edgeColorForProperty(value, node.type || 'Application', propertyKey);
}

export function nodeFillColorForValue(propertyKey: string, value: string): string {
  if (propertyKey === NODE_TYPE_COLOR_KEY) return '#ffffff';
  return edgeColorForProperty(value, 'Application', propertyKey);
}

export function nodeBorderColorForValue(propertyKey: string, value: string): string {
  if (propertyKey === NODE_TYPE_COLOR_KEY) return nodeColorForType(value);
  return edgeColorForProperty(value, 'Application', propertyKey);
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
  return value;
}

export function strokeColorForLegendSwatch(
  propertyKey: string,
  value: string,
  relationFallback = 'DEPENDS_ON'
): string {
  return edgeColorForProperty(value, relationFallback, propertyKey);
}

import type { GraphEdgeDto } from '@/types/api';
import {
  EDGE_TYPE_STYLES,
  edgeColorForProperty,
  legendLabelForData,
  sortDataTypesForLegend,
  type EdgeTypeKey,
} from './graphTheme';

/** Sentinel key: color edges by Neo4j relationship type (DEPENDS_ON, CONTAINS). */
export const RELATION_TYPE_COLOR_KEY = '__relation__';

export const EDGE_COLOR_PROPERTY_STORAGE_KEY = 'flowra.graph.edgeColorProperty';

/** Preferred display order for known DEPENDS_ON properties (seed-app-db.cypher). */
const KNOWN_PROPERTY_ORDER = ['data', 'asset_class', 'frequency', 'creation_date'] as const;

const INTERNAL_PROPERTY_KEYS = new Set(['validFrom', 'validTo', 'id']);

export const EDGE_COLOR_PROPERTY_LABELS: Record<string, string> = {
  data: 'Données échangées',
  asset_class: "Classe d'actifs",
  frequency: 'Fréquence',
  creation_date: 'Année de création',
  [RELATION_TYPE_COLOR_KEY]: 'Type de relation',
};

export function labelForColorProperty(key: string): string {
  return EDGE_COLOR_PROPERTY_LABELS[key] ?? key.replace(/_/g, ' ');
}

export function loadStoredColorPropertyKey(): string {
  try {
    return localStorage.getItem(EDGE_COLOR_PROPERTY_STORAGE_KEY) ?? 'data';
  } catch {
    return 'data';
  }
}

export function storeColorPropertyKey(key: string): void {
  try {
    localStorage.setItem(EDGE_COLOR_PROPERTY_STORAGE_KEY, key);
  } catch {
    /* ignore quota / private mode */
  }
}

/** Value used to pick a stroke color for one edge and one chosen property. */
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

/** Property keys that have at least one non-empty value on the loaded edges. */
export function discoverColorPropertyKeys(edges: GraphEdgeDto[]): string[] {
  const keys = new Set<string>();
  for (const edge of edges) {
    if (edge.properties) {
      for (const [key, value] of Object.entries(edge.properties)) {
        if (INTERNAL_PROPERTY_KEYS.has(key)) continue;
        if (value != null && String(value).trim()) keys.add(key);
      }
    }
    if (edge.data?.trim()) keys.add('data');
  }

  const known = KNOWN_PROPERTY_ORDER.filter((k) => keys.has(k));
  const rest = [...keys].filter((k) => !KNOWN_PROPERTY_ORDER.includes(k as (typeof KNOWN_PROPERTY_ORDER)[number])).sort();
  return [...known, ...rest];
}

/** Selector options: discovered properties plus relation type. */
export function colorPropertyOptions(edges: GraphEdgeDto[]): { key: string; label: string }[] {
  const keys = discoverColorPropertyKeys(edges);
  const options = keys.map((key) => ({ key, label: labelForColorProperty(key) }));
  options.push({ key: RELATION_TYPE_COLOR_KEY, label: labelForColorProperty(RELATION_TYPE_COLOR_KEY) });
  return options;
}

export function resolveColorPropertyKey(
  storedKey: string,
  edges: GraphEdgeDto[]
): string {
  const options = colorPropertyOptions(edges);
  if (options.some((o) => o.key === storedKey)) return storedKey;
  return options[0]?.key ?? 'data';
}

/** Distinct legend values for the active color property. */
export function collectLegendColorValues(
  edges: GraphEdgeDto[],
  propertyKey: string
): string[] {
  const values = edges
    .map((e) => edgeColorValue(e, propertyKey))
    .filter((v): v is string => Boolean(v?.trim()));

  if (propertyKey === 'data') {
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

export function legendLabelForColorValue(propertyKey: string, value: string): string {
  if (propertyKey === 'data') return legendLabelForData(value);
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

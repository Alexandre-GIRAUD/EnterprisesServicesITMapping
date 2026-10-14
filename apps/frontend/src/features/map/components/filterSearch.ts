import type { GraphNodeFilterDto } from '@/types/api';
import { nodeAttributeView, type FilterView } from './filterDimensionUtils';

/** Sentinel stored as a filter value when an application or flow has no value. */
export const EMPTY_FILTER_VALUE = '__empty__';

export const FILTER_SEARCH_LIMIT = 12;

export type FilterSearchKind = 'filter' | 'app' | 'attribute' | 'edge';

export type FilterSearchHit = {
  key: string;
  label: string;
  kind: FilterSearchKind;
  filterView?: FilterView;
  applicationId?: string;
  dimensionKey?: string;
  value?: string;
  edgeId?: string;
};

export type FilterSearchEdge = {
  id: string;
  label: string;
};

export function displayFilterValue(value: string, label: string): string {
  return value === EMPTY_FILTER_VALUE ? 'empty' : label;
}

type FilterSearchInput = {
  query: string;
  dimensions: GraphNodeFilterDto[];
  applications: ReadonlyArray<{ id: string; name?: string | null }>;
  edges: ReadonlyArray<FilterSearchEdge>;
  valueLabel: (dimension: GraphNodeFilterDto, value: string) => string;
};

function includesQuery(haystack: string, query: string): boolean {
  return haystack.toLowerCase().includes(query);
}

function filterNameHits(input: FilterSearchInput, query: string): FilterSearchHit[] {
  const hits: FilterSearchHit[] = [];
  if ('application'.includes(query) || 'applications'.includes(query)) {
    hits.push({
      key: 'filter:applications',
      label: 'Application',
      kind: 'filter',
      filterView: 'applications',
    });
  }
  for (const dimension of input.dimensions) {
    const haystack = `${dimension.label} ${dimension.key}`;
    if (!includesQuery(haystack, query)) continue;
    hits.push({
      key: `filter:${dimension.key}`,
      label: dimension.label,
      kind: 'filter',
      filterView: nodeAttributeView(dimension.key),
    });
  }
  return hits;
}

function applicationHits(input: FilterSearchInput, query: string): FilterSearchHit[] {
  const hits: FilterSearchHit[] = [];
  for (const application of input.applications) {
    const label = application.name?.trim() || application.id;
    if (!includesQuery(`${label} ${application.id}`, query)) continue;
    hits.push({ key: `app:${application.id}`, label, kind: 'app', applicationId: application.id });
  }
  return hits;
}

function attributeHits(input: FilterSearchInput, query: string): FilterSearchHit[] {
  const hits: FilterSearchHit[] = [];
  for (const dimension of input.dimensions) {
    hits.push(...attributeHitsForDimension(input, dimension, query));
  }
  return hits;
}

function attributeHitsForDimension(
  input: FilterSearchInput,
  dimension: GraphNodeFilterDto,
  query: string,
): FilterSearchHit[] {
  const hits: FilterSearchHit[] = [];
  for (const value of dimension.values) {
    const label = displayFilterValue(value, input.valueLabel(dimension, value));
    if (!includesQuery(`${label} ${dimension.label}`, query)) continue;
    hits.push({
      key: `attribute:${dimension.key}:${value}`,
      label,
      kind: 'attribute',
      dimensionKey: dimension.key,
      value,
    });
  }
  return hits;
}

function edgeHits(input: FilterSearchInput, query: string): FilterSearchHit[] {
  const hits: FilterSearchHit[] = [];
  for (const edge of input.edges) {
    if (!includesQuery(edge.label, query)) continue;
    hits.push({ key: `edge:${edge.id}`, label: edge.label, kind: 'edge', edgeId: edge.id });
  }
  return hits;
}

export function searchFilterHits(input: FilterSearchInput): FilterSearchHit[] {
  const query = input.query.trim().toLowerCase();
  if (!query) return [];
  const hits = [
    ...filterNameHits(input, query),
    ...applicationHits(input, query),
    ...attributeHits(input, query),
    ...edgeHits(input, query),
  ];
  return hits.slice(0, FILTER_SEARCH_LIMIT);
}

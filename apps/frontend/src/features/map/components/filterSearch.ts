import type { GraphNodeFilterDto } from '@/types/api';
import { EMPTY_FILTER_VALUE } from '../utils/emptyFilterValue';
import { nodeAttributeView, type FilterView } from './filterDimensionUtils';

export { EMPTY_FILTER_VALUE };

export const FILTER_SEARCH_LIMIT = 12;

export type FilterSearchKind = 'filter' | 'application' | 'attribute' | 'edge';

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

function isQueryInText(haystack: string, query: string): boolean {
  return haystack.toLowerCase().includes(query);
}

function collectFilterNameHits(input: FilterSearchInput, query: string): FilterSearchHit[] {
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
    if (!isQueryInText(haystack, query)) continue;
    hits.push({
      key: `filter:${dimension.key}`,
      label: dimension.label,
      kind: 'filter',
      filterView: nodeAttributeView(dimension.key),
    });
  }
  return hits;
}

function collectApplicationHits(input: FilterSearchInput, query: string): FilterSearchHit[] {
  const hits: FilterSearchHit[] = [];
  for (const application of input.applications) {
    const label = application.name?.trim() || application.id;
    if (!isQueryInText(`${label} ${application.id}`, query)) continue;
    hits.push({ key: `application:${application.id}`, label, kind: 'application', applicationId: application.id });
  }
  return hits;
}

function collectAttributeHits(input: FilterSearchInput, query: string): FilterSearchHit[] {
  const hits: FilterSearchHit[] = [];
  for (const dimension of input.dimensions) {
    hits.push(...collectAttributeHitsForDimension(input, dimension, query));
  }
  return hits;
}

function collectAttributeHitsForDimension(
  input: FilterSearchInput,
  dimension: GraphNodeFilterDto,
  query: string,
): FilterSearchHit[] {
  const hits: FilterSearchHit[] = [];
  for (const value of dimension.values) {
    const label = displayFilterValue(value, input.valueLabel(dimension, value));
    if (!isQueryInText(`${label} ${dimension.label}`, query)) continue;
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

function collectEdgeHits(input: FilterSearchInput, query: string): FilterSearchHit[] {
  const hits: FilterSearchHit[] = [];
  for (const edge of input.edges) {
    if (!isQueryInText(edge.label, query)) continue;
    hits.push({ key: `edge:${edge.id}`, label: edge.label, kind: 'edge', edgeId: edge.id });
  }
  return hits;
}

function limitHits(hits: FilterSearchHit[]): FilterSearchHit[] {
  return hits.slice(0, FILTER_SEARCH_LIMIT);
}

export function searchFilterHits(input: FilterSearchInput): FilterSearchHit[] {
  const query = input.query.trim().toLowerCase();
  if (!query) return [];
  return [
    ...limitHits(collectFilterNameHits(input, query)),
    ...limitHits(collectApplicationHits(input, query)),
    ...limitHits(collectAttributeHits(input, query)),
    ...limitHits(collectEdgeHits(input, query)),
  ];
}

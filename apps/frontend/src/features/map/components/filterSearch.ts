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

export function searchFilterHits(input: {
  query: string;
  dimensions: GraphNodeFilterDto[];
  applications: ReadonlyArray<{ id: string; name?: string | null }>;
  edges: ReadonlyArray<FilterSearchEdge>;
  valueLabel: (dimension: GraphNodeFilterDto, value: string) => string;
}): FilterSearchHit[] {
  const query = input.query.trim().toLowerCase();
  if (!query) return [];
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
    const haystack = `${dimension.label} ${dimension.key}`.toLowerCase();
    if (haystack.includes(query)) {
      hits.push({
        key: `filter:${dimension.key}`,
        label: dimension.label,
        kind: 'filter',
        filterView: nodeAttributeView(dimension.key),
      });
    }
  }
  for (const application of input.applications) {
    const label = application.name?.trim() || application.id;
    if (`${label} ${application.id}`.toLowerCase().includes(query)) {
      hits.push({
        key: `app:${application.id}`,
        label,
        kind: 'app',
        applicationId: application.id,
      });
    }
  }
  for (const dimension of input.dimensions) {
    for (const value of dimension.values) {
      const label = displayFilterValue(value, input.valueLabel(dimension, value));
      if (`${label} ${dimension.label}`.toLowerCase().includes(query)) {
        hits.push({
          key: `attribute:${dimension.key}:${value}`,
          label,
          kind: 'attribute',
          dimensionKey: dimension.key,
          value,
        });
      }
    }
  }
  for (const edge of input.edges) {
    if (edge.label.toLowerCase().includes(query)) {
      hits.push({
        key: `edge:${edge.id}`,
        label: edge.label,
        kind: 'edge',
        edgeId: edge.id,
      });
    }
  }
  return hits.slice(0, FILTER_SEARCH_LIMIT);
}

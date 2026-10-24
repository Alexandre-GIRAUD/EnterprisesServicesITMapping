import type { DataModelFieldDto, DataModelTarget } from '@/types/api';

export type DataModelSurface = 'app' | 'flows';

export function normalizeDataModelTarget(target?: DataModelTarget): DataModelTarget {
  if (target === 'NODE') return 'NODE';
  if (target === 'NODE_REF') return 'NODE_REF';
  return 'EDGE';
}

export function isFlowField(field: DataModelFieldDto): boolean {
  return normalizeDataModelTarget(field.target) === 'EDGE';
}

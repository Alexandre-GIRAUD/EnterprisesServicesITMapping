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

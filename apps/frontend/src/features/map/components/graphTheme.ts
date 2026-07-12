import { MarkerType, type Edge } from '@xyflow/react';

/**
 * Single source of truth for graph node/edge colors. Shared by the graphs and
 * the {@link GraphLegend} so the legend always matches what is rendered.
 */

export type NodeTypeKey = 'Application' | 'Module';
export type EdgeTypeKey = 'DEPENDS_ON' | 'CONTAINS';

export type NodeTypeStyle = {
  /** French label shown in the legend. */
  legendLabel: string;
  /** Border color of the node card. */
  color: string;
};

export type EdgeTypeStyle = {
  /** Label shown in the legend. */
  legendLabel: string;
  /** Stroke (and arrowhead) color. */
  color: string;
  /** Dash pattern, when the relation should read as non-solid. */
  dashed?: boolean;
};

export const NODE_TYPE_STYLES: Record<NodeTypeKey, NodeTypeStyle> = {
  Application: { legendLabel: 'Application', color: '#3b82f6' },
  Module: { legendLabel: 'Module', color: '#52525b' },
};

const NEUTRAL_NODE_COLOR = '#52525b';
const NEUTRAL_EDGE_COLOR = '#64748b';

/** Colors keyed by Neo4j `r.data` on DEPENDS_ON links (seed-app-db.cypher). */
export const DATA_TYPE_STYLES: Record<string, EdgeTypeStyle> = {
  'referential data': { legendLabel: 'Referential data', color: '#2563eb' },
  'cash flows': { legendLabel: 'Cash flows', color: '#059669' },
  'clearing data': { legendLabel: 'Clearing data', color: '#d97706' },
  PV: { legendLabel: 'PV', color: '#7c3aed' },
  'trade economics': { legendLabel: 'Trade economics', color: '#db2777' },
  // AI connection kinds (r.data set by the connection-discovery agent).
  API: { legendLabel: 'API', color: '#2563eb' },
  KAFKA: { legendLabel: 'Kafka', color: '#7c3aed' },
  MQ: { legendLabel: 'Message queue', color: '#db2777' },
  NAS: { legendLabel: 'NAS / file share', color: '#0891b2' },
  FILE_SHARE: { legendLabel: 'File share', color: '#0891b2' },
  DATABASE: { legendLabel: 'Database', color: '#059669' },
  GRPC: { legendLabel: 'gRPC', color: '#d97706' },
  SOAP: { legendLabel: 'SOAP', color: '#9333ea' },
  SFTP: { legendLabel: 'SFTP', color: '#65a30d' },
  OTHER: { legendLabel: 'Other integration', color: '#64748b' },
};

export const KNOWN_DATA_TYPE_KEYS = Object.keys(DATA_TYPE_STYLES);

/** Border/identity color for a node relation type (neutral fallback). */
export function nodeColorForType(type: string): string {
  return (NODE_TYPE_STYLES as Record<string, NodeTypeStyle | undefined>)[type]?.color
    ?? NEUTRAL_NODE_COLOR;
}

/**
 * Semantic-zoom thresholds (React Flow zoom factor). Secondary detail fades out
 * below these values so a screen-filling overview stays readable.
 */
export const ZOOM_THRESHOLDS = {
  /** Below this, node titles/labels fade out (overview = colored boxes only). */
  primaryLabel: 0.45,
  /** Below this, secondary text (descriptions) and edge labels fade out. */
  secondaryDetail: 0.7,
} as const;

export const EDGE_TYPE_STYLES: Record<EdgeTypeKey, EdgeTypeStyle> = {
  DEPENDS_ON: { legendLabel: 'Dependency', color: '#64748b' },
  CONTAINS: { legendLabel: 'Composition', color: '#0284c7', dashed: true },
};

function edgeStyleEntry(type: string): EdgeTypeStyle | undefined {
  return (EDGE_TYPE_STYLES as Record<string, EdgeTypeStyle | undefined>)[type];
}

function hashColor(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (Math.imul(31, h) + text.charCodeAt(i)) >>> 0;
  }
  return `hsl(${h % 360} 52% 42%)`;
}

/** Resolve stroke color from a property value, else relation type. */
export function edgeColorForProperty(
  value: string | null | undefined,
  relationType: string,
  propertyKey: string
): string {
  if (propertyKey === '__relation__') {
    return edgeColorForType(value?.trim() || relationType);
  }
  const key = value?.trim();
  if (!key) {
    return edgeColorForType(relationType);
  }
  if (propertyKey === 'data' && DATA_TYPE_STYLES[key]) {
    return DATA_TYPE_STYLES[key].color;
  }
  return hashColor(`${propertyKey}:${key}`);
}

/** Legend label for a data type key (falls back to the raw key). */
export function legendLabelForData(dataKey: string): string {
  return DATA_TYPE_STYLES[dataKey]?.legendLabel ?? dataKey;
}

/** Stable display order: known palette first, then any other values alphabetically. */
export function sortDataTypesForLegend(types: Iterable<string>): string[] {
  const present = new Set([...types].map((t) => t.trim()).filter(Boolean));
  const known = KNOWN_DATA_TYPE_KEYS.filter((k) => present.has(k));
  const unknown = [...present].filter((k) => !KNOWN_DATA_TYPE_KEYS.includes(k)).sort();
  return [...known, ...unknown];
}

export function edgeDashedForRelation(relationType: string): boolean {
  return Boolean(edgeStyleEntry(relationType)?.dashed);
}

/** Resolve the stroke color for an edge relation type (neutral fallback). */
export function edgeColorForType(type: string): string {
  return edgeStyleEntry(type)?.color ?? NEUTRAL_EDGE_COLOR;
}

/**
 * Full React Flow edge styling (stroke + dash + matching arrowhead + label)
 * for a given relation type. Keeps both graphs visually consistent.
 */
export function edgeStyleForType(type: string): Pick<
  Edge,
  'type' | 'style' | 'labelStyle' | 'labelBgStyle' | 'markerEnd'
> {
  const entry = edgeStyleEntry(type);
  const color = entry?.color ?? NEUTRAL_EDGE_COLOR;
  return {
    type: 'straight',
    style: {
      stroke: color,
      strokeWidth: 1.5,
      opacity: 0.9,
      ...(entry?.dashed ? { strokeDasharray: '6 4' } : {}),
    },
    labelStyle: { fill: '#475569', fontSize: 9 },
    labelBgStyle: { fill: 'transparent' },
    markerEnd: { type: MarkerType.ArrowClosed, color },
  };
}

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
const NEUTRAL_EDGE_COLOR = '#334155';

/** ponytail: 8 fixed slots, a 9th value reuses one. Add slots if legends regularly exceed 8. */
export const PASTEL_NODE_PALETTE = [
  '#f8b4b4',
  '#7ed8cc',
  '#c8b6f8',
  '#e6ee7a',
  '#9ec8f8',
  '#b6e8a0',
  '#f8c48a',
  '#f6c6f4',
] as const;

/** Distinct darks, same slot order as the node pastels. */
export const DARK_EDGE_PALETTE = [
  '#991b1b',
  '#0f766e',
  '#6d28d9',
  '#854d0e',
  '#1e3a8a',
  '#3f6212',
  '#c2410c',
  '#44403c',
] as const;

function colorSlot(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  return (hash >>> 0) % PASTEL_NODE_PALETTE.length;
}

export function pastelNodeColor(text: string): string {
  return PASTEL_NODE_PALETTE[colorSlot(text)];
}

export function darkEdgeColor(text: string): string {
  return DARK_EDGE_PALETTE[colorSlot(text)];
}

/** Border/identity color for a node relation type (neutral fallback). */
export function nodeColorForType(type: string): string {
  return (NODE_TYPE_STYLES as Record<string, NodeTypeStyle | undefined>)[type]?.color
    ?? NEUTRAL_NODE_COLOR;
}

/**
 * Semantic-zoom thresholds (React Flow zoom factor).
 * Node titles stay drawn at every zoom and scale with the node.
 * Secondary text fades out below this value.
 */
export const ZOOM_THRESHOLDS = {
  /** Below this, descriptions and edge labels fade out. */
  secondaryDetail: 0.7,
} as const;

export const EDGE_TYPE_STYLES: Record<EdgeTypeKey, EdgeTypeStyle> = {
  DEPENDS_ON: { legendLabel: 'Dependency', color: '#1e3a8a' },
  CONTAINS: { legendLabel: 'Composition', color: '#c2410c', dashed: true },
};

function edgeStyleEntry(type: string): EdgeTypeStyle | undefined {
  return (EDGE_TYPE_STYLES as Record<string, EdgeTypeStyle | undefined>)[type];
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
  return darkEdgeColor(`${propertyKey}:${key}`);
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

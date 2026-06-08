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
  /** French label shown in the legend. */
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
  DEPENDS_ON: { legendLabel: 'Dépendance', color: '#64748b' },
  CONTAINS: { legendLabel: 'Composition', color: '#0284c7', dashed: true },
};

function edgeStyleEntry(type: string): EdgeTypeStyle | undefined {
  return (EDGE_TYPE_STYLES as Record<string, EdgeTypeStyle | undefined>)[type];
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

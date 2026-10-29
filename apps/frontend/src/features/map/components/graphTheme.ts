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

/**
 * Pastel fills taken from the cartography reference: blue, teal, lavender, olive,
 * terracotta, pink, amber, mint. Preferred defaults for the first slots; further
 * values get unique derived tones from {@link preferredPaletteColor}.
 */
export const PASTEL_NODE_PALETTE = [
  '#a9ccf5',
  '#86dccf',
  '#d9bff5',
  '#d6e28a',
  '#e6b49a',
  '#f8b0c4',
  '#ffe08a',
  '#b4eaa8',
] as const;

/** Distinct darks, same slot order as the node pastels (matching link strokes). */
export const DARK_EDGE_PALETTE = [
  '#1d63c9',
  '#0f766e',
  '#7c3aed',
  '#667f10',
  '#8a4b2a',
  '#c1121f',
  '#b45309',
  '#1f7a1f',
] as const;

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function toHexByte(value: number): string {
  return clampByte(value).toString(16).padStart(2, '0');
}

function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6;
  else if (max === gg) h = ((bb - rr) / d + 2) / 6;
  else h = ((rr - gg) / d + 4) / 6;
  return { h: h * 360, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hh = ((h % 360) + 360) % 360;
  if (s === 0) {
    const gray = clampByte(l * 255);
    return { r: gray, g: gray, b: gray };
  }
  const hueToRgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = hh / 360;
  return {
    r: clampByte(hueToRgb(p, q, hk + 1 / 3) * 255),
    g: clampByte(hueToRgb(p, q, hk) * 255),
    b: clampByte(hueToRgb(p, q, hk - 1 / 3) * 255),
  };
}

/**
 * Preferred default at slot `index`: curated palette first, then unique
 * hue/lightness shifts of those tones so values of one parameter never share
 * a default color.
 */
export function preferredPaletteColor(palette: readonly string[], index: number): string {
  if (palette.length === 0) return '#888888';
  if (index < palette.length) return palette[index];
  const base = palette[index % palette.length];
  const generation = Math.floor(index / palette.length);
  const rgb = parseHexRgb(base);
  if (!rgb) return base;
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const shifted = hslToRgb(
    hsl.h + generation * 23,
    Math.min(0.92, hsl.s + (generation % 2) * 0.06),
    Math.max(0.18, Math.min(0.88, hsl.l + (generation % 3 === 0 ? -0.08 : 0.06))),
  );
  return `#${toHexByte(shifted.r)}${toHexByte(shifted.g)}${toHexByte(shifted.b)}`;
}

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
 * Node titles and flow labels stay drawn at every zoom and scale with the map.
 * Module descriptions fade out below this value.
 */
export const ZOOM_THRESHOLDS = {
  /** Below this, module descriptions fade out. */
  secondaryDetail: 0.7,
} as const;

export const EDGE_TYPE_STYLES: Record<EdgeTypeKey, EdgeTypeStyle> = {
  DEPENDS_ON: { legendLabel: 'Dependency', color: '#1d4ed8' },
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

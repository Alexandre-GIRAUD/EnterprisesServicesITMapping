import type { GraphEdgeDto, GraphNodeDto } from '@/types/api';
import { storedAttributeText } from '../utils/attributeValue';
import {
  DARK_EDGE_PALETTE,
  EDGE_TYPE_STYLES,
  PASTEL_NODE_PALETTE,
  edgeColorForProperty,
  nodeColorForType,
  pastelNodeColor,
  preferredPaletteColor,
  type EdgeTypeKey,
} from './graphTheme';

/** Sentinel: paint by relationship / flow type. */
export const RELATION_TYPE_COLOR_KEY = '__relation__';
/** Sentinel: paint by app / node type. */
export const NODE_TYPE_COLOR_KEY = '__type__';
/** Sentinel: paint each box by its name. */
export const NODE_LABEL_COLOR_KEY = '__label__';
/** Sentinel in Link label select: hide all edge labels. */
export const HIDE_EDGE_LABELS_KEY = '__hide_labels__';
/** Border when fill is white / near-white (derived border would be invisible). */
export const LIGHT_BORDER_ON_WHITE = '#cbd5e1';
/** Darkening applied to a node fill to derive its default border. */
const BORDER_DARKEN_AMOUNT = 0.45;
/** Extra darkening of a border to derive the default label text. */
const TEXT_DARKEN_AMOUNT = 0.4;
/** Darkening of a node-type color when used as a default border. */
const TYPE_BORDER_DARKEN_AMOUNT = 0.3;

export const EDGE_COLOR_PROPERTY_STORAGE_KEY = 'flowra.graph.edgeColorProperty';
export const EDGE_LABEL_PROPERTY_STORAGE_KEY = 'flowra.graph.edgeLabelProperty';
export const APP_FILL_PROPERTY_STORAGE_KEY = 'flowra.graph.appFillProperty';
export const APP_BORDER_PROPERTY_STORAGE_KEY = 'flowra.graph.appBorderProperty';
export const APP_TEXT_PROPERTY_STORAGE_KEY = 'flowra.graph.appTextProperty';
export const LEGEND_COLORS_STORAGE_KEY = 'flowra.graph.legendColors';
export const LEGEND_SETUPS_STORAGE_KEY = 'flowra.graph.legendSetups';
export const HIDE_EDGE_LABELS_STORAGE_KEY = 'flowra.graph.hideEdgeLabels';

const INTERNAL_PROPERTY_KEYS = new Set(['validFrom', 'validTo', 'id', 'name', 'description', 'year']);

export const EDGE_COLOR_PROPERTY_LABELS: Record<string, string> = {
  [RELATION_TYPE_COLOR_KEY]: 'Flow',
  [NODE_TYPE_COLOR_KEY]: 'App',
  [NODE_LABEL_COLOR_KEY]: 'Name',
};

export type AttributeOption = { key: string; label: string };

export type LegendColorMaps = {
  edgeStroke?: Record<string, string>;
  edgeLabel?: Record<string, string>;
  appFill?: Record<string, string>;
  appBorder?: Record<string, string>;
  appText?: Record<string, string>;
};

export type LegendCodingKeys = {
  edgeColorKey: string;
  edgeLabelKey: string;
  appFillKey: string;
  appBorderKey: string;
  /** Absent in older saved legends: text then follows the border attribute. */
  appTextKey?: string;
};

export type LegendSetup = LegendCodingKeys & {
  id: string;
  name: string;
  colors: LegendColorMaps;
  hideEdgeLabels?: boolean;
};

/** Snapshot of active legend coding (pin view / apply view). */
export type GraphLegendSnapshot = LegendCodingKeys & {
  colors?: LegendColorMaps;
  hideEdgeLabels?: boolean;
};

export function labelForColorProperty(key: string): string {
  return EDGE_COLOR_PROPERTY_LABELS[key] ?? key.replace(/_/g, ' ');
}

function loadStoredKey(storageKey: string, fallback: string): string {
  try {
    return localStorage.getItem(storageKey) ?? fallback;
  } catch {
    return fallback;
  }
}

function storeKey(storageKey: string, key: string): void {
  try {
    localStorage.setItem(storageKey, key);
  } catch {
    /* ignore */
  }
}

export function loadStoredColorPropertyKey(): string {
  return loadStoredKey(EDGE_COLOR_PROPERTY_STORAGE_KEY, RELATION_TYPE_COLOR_KEY);
}

export function storeColorPropertyKey(key: string): void {
  storeKey(EDGE_COLOR_PROPERTY_STORAGE_KEY, key);
}

export function loadStoredLabelPropertyKey(): string {
  return loadStoredKey(EDGE_LABEL_PROPERTY_STORAGE_KEY, 'data');
}

export function storeLabelPropertyKey(key: string): void {
  storeKey(EDGE_LABEL_PROPERTY_STORAGE_KEY, key);
}

export function loadStoredAppFillKey(): string {
  return loadStoredKey(APP_FILL_PROPERTY_STORAGE_KEY, NODE_TYPE_COLOR_KEY);
}

export function storeAppFillKey(key: string): void {
  storeKey(APP_FILL_PROPERTY_STORAGE_KEY, key);
}

export function loadStoredAppBorderKey(): string {
  return loadStoredKey(APP_BORDER_PROPERTY_STORAGE_KEY, NODE_TYPE_COLOR_KEY);
}

export function storeAppBorderKey(key: string): void {
  storeKey(APP_BORDER_PROPERTY_STORAGE_KEY, key);
}

export function loadStoredAppTextKey(): string {
  return loadStoredKey(APP_TEXT_PROPERTY_STORAGE_KEY, NODE_TYPE_COLOR_KEY);
}

export function storeAppTextKey(key: string): void {
  storeKey(APP_TEXT_PROPERTY_STORAGE_KEY, key);
}

export const TEXT_PROPERTY_CHOSEN_KEY = 'flowra.graph.appTextChosen';
export const FILL_PROPERTY_CHOSEN_KEY = 'flowra.graph.appFillChosen';
export const BORDER_PROPERTY_CHOSEN_KEY = 'flowra.graph.appBorderChosen';
export const STROKE_PROPERTY_CHOSEN_KEY = 'flowra.graph.edgeColorChosen';
export const LABEL_PROPERTY_CHOSEN_KEY = 'flowra.graph.edgeLabelChosen';

function loadChosen(storageKey: string): boolean {
  try {
    return localStorage.getItem(storageKey) === '1';
  } catch {
    return false;
  }
}

function storeChosen(storageKey: string): void {
  try {
    localStorage.setItem(storageKey, '1');
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadFillPropertyChosen(): boolean {
  return loadChosen(FILL_PROPERTY_CHOSEN_KEY);
}

export function storeFillPropertyChosen(): void {
  storeChosen(FILL_PROPERTY_CHOSEN_KEY);
}

export function loadTextPropertyChosen(): boolean {
  return loadChosen(TEXT_PROPERTY_CHOSEN_KEY);
}

export function storeTextPropertyChosen(): void {
  storeChosen(TEXT_PROPERTY_CHOSEN_KEY);
}

export function loadBorderPropertyChosen(): boolean {
  return loadChosen(BORDER_PROPERTY_CHOSEN_KEY);
}

export function storeBorderPropertyChosen(): void {
  storeChosen(BORDER_PROPERTY_CHOSEN_KEY);
}

export function loadStrokePropertyChosen(): boolean {
  return loadChosen(STROKE_PROPERTY_CHOSEN_KEY);
}

export function storeStrokePropertyChosen(): void {
  storeChosen(STROKE_PROPERTY_CHOSEN_KEY);
}

export function loadLabelPropertyChosen(): boolean {
  return loadChosen(LABEL_PROPERTY_CHOSEN_KEY);
}

export function storeLabelPropertyChosen(): void {
  storeChosen(LABEL_PROPERTY_CHOSEN_KEY);
}

/** Follow a parent channel until the user explicitly picks this one. */
export function resolveMirroredKey(input: {
  storedKey: string;
  mirrorKey: string;
  userChose: boolean;
}): string {
  if (input.userChose) return input.storedKey;
  return input.mirrorKey;
}

export type ColorValueCount = { key: string; distinct: number; covered?: number };

/** Prefer the attribute whose values fit the palette, so defaults stay different. */
export function chooseSpreadColorKey(
  counts: readonly ColorValueCount[],
  paletteSize: number,
  fallback: string,
  population = 0,
): string {
  let bestKey = fallback;
  let bestScore = 0;
  for (const count of counts) {
    if (count.distinct < 2) continue;
    const variety = count.distinct <= paletteSize ? count.distinct : paletteSize / count.distinct;
    const covered = count.covered ?? count.distinct;
    const uncovered = Math.max(0, population - covered);
    const score = covered * variety - uncovered * paletteSize;
    if (score > bestScore) {
      bestScore = score;
      bestKey = count.key;
    }
  }
  return bestKey;
}

/**
 * Assign preferred defaults so each value of a parameter gets a unique color.
 * Curated palette slots are used first; further values get derived unique tones.
 * Explicit legend overrides win (and may deliberately collide).
 */
export function distinctColorMap(
  values: readonly string[],
  palette: readonly string[],
  overrides?: Record<string, string>,
): Record<string, string> {
  const generated: Record<string, string> = {};
  const usedDefaults = new Set<string>();
  let slot = 0;
  for (const value of values) {
    if (!value) continue;
    if (overrides?.[value]) {
      generated[value] = overrides[value];
      continue;
    }
    let color = preferredPaletteColor(palette, slot);
    slot += 1;
    while (usedDefaults.has(color.toLowerCase())) {
      color = preferredPaletteColor(palette, slot);
      slot += 1;
    }
    usedDefaults.add(color.toLowerCase());
    generated[value] = color;
  }
  return { ...generated, ...overrides };
}

export function hasCustomColor(map: Record<string, string> | undefined): boolean {
  return Boolean(map && Object.keys(map).length > 0);
}

/** Keep an explicit legend choice. Otherwise leave the single-color sentinel for a varied attribute. */
export function resolveUntouchedColorKey(input: {
  storedKey: string;
  sentinel: string;
  userChose: boolean;
  hasCustomColor: boolean;
  counts: readonly ColorValueCount[];
  paletteSize: number;
  population?: number;
}): string {
  if (input.userChose || input.hasCustomColor) return input.storedKey;
  return chooseSpreadColorKey(
    input.counts,
    input.paletteSize,
    input.sentinel,
    input.population ?? 0,
  );
}

/** Legend overrides stay. Attribute channels get distinct palette defaults. Type/flow sentinels do not. */
export function paintChannelColors(input: {
  colors?: LegendColorMaps;
  fillKey: string;
  fillValues: readonly string[];
  strokeKey: string;
  strokeValues: readonly string[];
  borderKey?: string;
  textKey?: string;
  textValues?: readonly string[];
}): LegendColorMaps {
  const colors = input.colors ?? {};
  const textFollowsBorder =
    input.textKey == null ||
    input.textKey === NODE_TYPE_COLOR_KEY ||
    input.textKey === input.borderKey;
  return {
    ...colors,
    appText: textFollowsBorder
      ? colors.appText
      : distinctColorMap(input.textValues ?? [], DARK_EDGE_PALETTE, colors.appText),
    appFill:
      input.fillKey === NODE_TYPE_COLOR_KEY
        ? colors.appFill
        : distinctColorMap(input.fillValues, PASTEL_NODE_PALETTE, colors.appFill),
    edgeStroke:
      input.strokeKey === RELATION_TYPE_COLOR_KEY
        ? colors.edgeStroke
        : distinctColorMap(input.strokeValues, DARK_EDGE_PALETTE, colors.edgeStroke),
  };
}

export function loadLegendColorMaps(): LegendColorMaps {
  try {
    const raw = localStorage.getItem(LEGEND_COLORS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as LegendColorMaps;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function storeLegendColorMaps(colors: LegendColorMaps): void {
  try {
    localStorage.setItem(LEGEND_COLORS_STORAGE_KEY, JSON.stringify(colors));
  } catch {
    /* ignore */
  }
}

export function loadHideEdgeLabels(): boolean {
  try {
    return localStorage.getItem(HIDE_EDGE_LABELS_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function storeHideEdgeLabels(hide: boolean): void {
  try {
    localStorage.setItem(HIDE_EDGE_LABELS_STORAGE_KEY, hide ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** Slightly darker shade of a CSS hex/rgb color (~18%). */
export function darkenColor(color: string, amount = 0.18): string {
  const rgb = parseCssColor(color);
  if (!rgb) return color;
  const f = 1 - amount;
  const r = Math.max(0, Math.min(255, Math.round(rgb.r * f)));
  const g = Math.max(0, Math.min(255, Math.round(rgb.g * f)));
  const b = Math.max(0, Math.min(255, Math.round(rgb.b * f)));
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function isNearWhite(color: string): boolean {
  const t = color.trim().toLowerCase();
  if (t === 'white' || t === '#fff' || t === '#ffffff') return true;
  const rgb = parseCssColor(color);
  if (!rgb) return false;
  return rgb.r >= 245 && rgb.g >= 245 && rgb.b >= 245;
}

/** Border derived from fill: light grey on white, else a clearly darker fill. */
export function borderFromFill(fill: string): string {
  if (isNearWhite(fill)) return LIGHT_BORDER_ON_WHITE;
  return darkenColor(fill, BORDER_DARKEN_AMOUNT);
}

/** Default label text: darker than the border so it reads on the tinted fill. */
export function textFromFill(fill: string): string {
  return darkenColor(borderFromFill(fill), TEXT_DARKEN_AMOUNT);
}

/** Type-color border, deepened to match derived borders. */
function typeBorderColor(type: string): string {
  return darkenColor(nodeColorForType(type), TYPE_BORDER_DARKEN_AMOUNT);
}

function toHex(n: number): string {
  return n.toString(16).padStart(2, '0');
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.max(0, Math.min(100, s)) / 100;
  const ll = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (hh < 60) {
    rp = c;
    gp = x;
  } else if (hh < 120) {
    rp = x;
    gp = c;
  } else if (hh < 180) {
    gp = c;
    bp = x;
  } else if (hh < 240) {
    gp = x;
    bp = c;
  } else if (hh < 300) {
    rp = x;
    bp = c;
  } else {
    rp = c;
    bp = x;
  }
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

function parseCssColor(color: string): { r: number; g: number; b: number } | null {
  const hex = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    };
  }
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    return {
      r: parseInt(hex[1]! + hex[1]!, 16),
      g: parseInt(hex[2]! + hex[2]!, 16),
      b: parseInt(hex[3]! + hex[3]!, 16),
    };
  }
  if (hex.toLowerCase() === 'white') return { r: 255, g: 255, b: 255 };
  if (hex.toLowerCase() === 'black') return { r: 0, g: 0, b: 0 };
  const rgbComma = hex.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbComma) {
    return { r: Number(rgbComma[1]), g: Number(rgbComma[2]), b: Number(rgbComma[3]) };
  }
  const rgbSpace = hex.match(/^rgba?\(\s*(\d+)\s+(\d+)\s+(\d+)/i);
  if (rgbSpace) {
    return { r: Number(rgbSpace[1]), g: Number(rgbSpace[2]), b: Number(rgbSpace[3]) };
  }
  const hsl = hex.match(
    /^hsla?\(\s*([\d.]+)(?:deg)?\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%/i
  );
  if (hsl) {
    return hslToRgb(Number(hsl[1]), Number(hsl[2]), Number(hsl[3]));
  }
  return null;
}

/**
 * Normalize any CSS color used on the graph to `#rrggbb` for `<input type="color">`.
 * Keeps the picker swatch aligned with the color currently painted.
 */
export function cssColorToHex(color: string): string {
  const parsed = parseCssColor(color);
  if (parsed) {
    return `#${toHex(parsed.r)}${toHex(parsed.g)}${toHex(parsed.b)}`;
  }
  if (typeof document !== 'undefined') {
    try {
      const ctx = document.createElement('canvas').getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#000000';
        ctx.fillStyle = color;
        const normalized = String(ctx.fillStyle);
        const fromCanvas = parseCssColor(normalized);
        if (fromCanvas) {
          return `#${toHex(fromCanvas.r)}${toHex(fromCanvas.g)}${toHex(fromCanvas.b)}`;
        }
      }
    } catch {
      /* ignore */
    }
  }
  return '#64748b';
}

export function loadLegendSetups(): LegendSetup[] {
  try {
    const raw = localStorage.getItem(LEGEND_SETUPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LegendSetup[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function storeLegendSetups(setups: LegendSetup[]): void {
  try {
    localStorage.setItem(LEGEND_SETUPS_STORAGE_KEY, JSON.stringify(setups));
  } catch {
    /* ignore */
  }
}

/** Visible apps/edges after filters (+ hide). Read-only slice. */
export function visibleGraphElements(
  graphNodes: GraphNodeDto[],
  graphEdges: GraphEdgeDto[],
  hiddenNodeIds: ReadonlySet<string> = new Set()
): { nodes: GraphNodeDto[]; edges: GraphEdgeDto[] } {
  const nodes = graphNodes.filter((n) => !hiddenNodeIds.has(n.id));
  const visible = new Set(nodes.map((n) => n.id));
  const edges = graphEdges.filter(
    (e) => visible.has(e.sourceId) && visible.has(e.targetId)
  );
  return { nodes, edges };
}

/** True when no business attrs exist on visible elements — only App / Flow sentinels. */
export function isSimpleLegendMode(
  visibleNodes: GraphNodeDto[],
  visibleEdges: GraphEdgeDto[]
): boolean {
  return (
    discoverColorPropertyKeys(visibleEdges).length === 0 &&
    discoverNodePropertyKeys(visibleNodes).length === 0
  );
}

/** Read-only: value used for stroke / label for one edge. Never writes. */
export function edgeColorValue(edge: GraphEdgeDto, propertyKey: string): string | null {
  if (propertyKey === RELATION_TYPE_COLOR_KEY) {
    return edge.type?.trim() || null;
  }
  return storedAttributeText(edge.properties?.[propertyKey]) || null;
}

export function edgeLabelText(edge: GraphEdgeDto, propertyKey: string): string {
  return edgeColorValue(edge, propertyKey)?.trim() || edge.type?.trim() || 'DEPENDS_ON';
}

function presentKeysFromProps(
  items: ReadonlyArray<{ readonly properties?: Readonly<Record<string, string | string[]>> | null }>
): Set<string> {
  const keys = new Set<string>();
  for (const item of items) {
    if (!item.properties) continue;
    for (const [key, value] of Object.entries(item.properties)) {
      if (INTERNAL_PROPERTY_KEYS.has(key)) continue;
      if (value != null && String(value).trim()) keys.add(key);
    }
  }
  return keys;
}

function orderKeys(keys: string[]): string[] {
  return [...keys].sort();
}

export function discoverColorPropertyKeys(edges: GraphEdgeDto[]): string[] {
  return orderKeys([...presentKeysFromProps(edges)]);
}

export function colorPropertyOptions(edges: GraphEdgeDto[]): AttributeOption[] {
  const options = discoverColorPropertyKeys(edges).map((key) => ({
    key,
    label: labelForColorProperty(key),
  }));
  options.push({
    key: RELATION_TYPE_COLOR_KEY,
    label: labelForColorProperty(RELATION_TYPE_COLOR_KEY),
  });
  return options;
}

export function resolveColorPropertyKey(storedKey: string, edges: GraphEdgeDto[]): string {
  const options = colorPropertyOptions(edges);
  if (options.some((o) => o.key === storedKey)) return storedKey;
  return options[0]?.key ?? RELATION_TYPE_COLOR_KEY;
}

function referenceValues(node: GraphNodeDto, propertyKey: string): string[] {
  return (node.nodeRefs?.[propertyKey] ?? []).map((value) => value.trim()).filter(Boolean);
}

export function discoverNodePropertyKeys(nodes: GraphNodeDto[]): string[] {
  const keys = presentKeysFromProps(nodes);
  for (const node of nodes) {
    for (const key of Object.keys(node.nodeRefs ?? {})) {
      if (INTERNAL_PROPERTY_KEYS.has(key)) continue;
      if (referenceValues(node, key).length > 0) keys.add(key);
    }
  }
  return orderKeys([...keys]);
}

export function nodePropertyOptions(nodes: GraphNodeDto[]): AttributeOption[] {
  const options = discoverNodePropertyKeys(nodes).map((key) => ({
    key,
    label: labelForColorProperty(key),
  }));
  options.push({
    key: NODE_LABEL_COLOR_KEY,
    label: labelForColorProperty(NODE_LABEL_COLOR_KEY),
  });
  options.push({
    key: NODE_TYPE_COLOR_KEY,
    label: labelForColorProperty(NODE_TYPE_COLOR_KEY),
  });
  return options;
}

export function resolveNodePropertyKey(storedKey: string, nodes: GraphNodeDto[]): string {
  const options = nodePropertyOptions(nodes);
  if (options.some((o) => o.key === storedKey)) return storedKey;
  return options[0]?.key ?? NODE_TYPE_COLOR_KEY;
}

export function nodePropValue(node: GraphNodeDto, propertyKey: string): string | null {
  if (propertyKey === NODE_TYPE_COLOR_KEY) {
    return node.type?.trim() || null;
  }
  if (propertyKey === NODE_LABEL_COLOR_KEY) {
    return node.label?.trim() || null;
  }
  const references = referenceValues(node, propertyKey);
  if (references.length === 1) return references[0];
  if (references.length > 1) return null;
  const text = storedAttributeText(node.properties?.[propertyKey]);
  return text || null;
}

function overrideOr(
  map: Record<string, string> | undefined,
  value: string | null | undefined,
  fallback: string
): string {
  if (value && map?.[value]) return map[value];
  return fallback;
}

/** Default edge stroke (no custom override). */
export function defaultEdgeStrokeColor(
  value: string | null,
  relationType: string,
  propertyKey: string
): string {
  return edgeColorForProperty(value, relationType, propertyKey);
}

export function paintEdgeStrokeColor(
  value: string | null,
  relationType: string,
  propertyKey: string,
  colorMap?: Record<string, string>
): string {
  const fallback = defaultEdgeStrokeColor(value, relationType, propertyKey);
  return overrideOr(colorMap, value, fallback);
}

export function paintEdgeLabelColor(
  value: string | null,
  relationType: string,
  propertyKey: string,
  colorMap?: Record<string, string>,
  strokeFallback?: string
): string {
  if (value && colorMap?.[value]) return colorMap[value];
  if (strokeFallback) return strokeFallback;
  return defaultEdgeStrokeColor(value, relationType, propertyKey);
}

/**
 * Edge label text color always matches the edge stroke (Link label only changes text).
 */
export function resolveSharedEdgeLabelColor(
  _colorKey: string,
  _labelKey: string,
  _labelValue: string | null,
  _relationType: string,
  _colors: LegendColorMaps | undefined,
  strokeColor: string
): string {
  return strokeColor;
}

function defaultNodeFill(propertyKey: string, value: string): string {
  const key = propertyKey === NODE_TYPE_COLOR_KEY ? value : `${propertyKey}:${value}`;
  return pastelNodeColor(key);
}

export function nodeFillColor(
  node: GraphNodeDto,
  propertyKey: string,
  colorMap?: Record<string, string>
): string {
  const value = nodePropValue(node, propertyKey);
  if (!value) return '#ffffff';
  return overrideOr(colorMap, value, defaultNodeFill(propertyKey, value));
}

/**
 * Border color. When {@link fillKey} equals border key, border is a darker shade of fill
 * (except default App/type sentinel with no custom fill → keep type border color).
 */
export function nodeBorderColor(
  node: GraphNodeDto,
  propertyKey: string,
  colorMap?: Record<string, string>,
  fillKey?: string,
  fillColorMap?: Record<string, string>
): string {
  if (fillKey && fillKey === propertyKey) {
    const value = nodePropValue(node, fillKey);
    if (value && colorMap?.[value]) return colorMap[value];
    return borderFromFill(nodeFillColor(node, fillKey, fillColorMap));
  }
  if (propertyKey === NODE_TYPE_COLOR_KEY) {
    const value = nodePropValue(node, propertyKey);
    const fallback = typeBorderColor(node.type);
    return overrideOr(colorMap, value, fallback);
  }
  const value = nodePropValue(node, propertyKey);
  if (!value) return typeBorderColor(node.type);
  return overrideOr(colorMap, value, edgeColorForProperty(value, 'Application', propertyKey));
}

/**
 * Text color inside a node. Default: a darker shade of the border color.
 * With its own attribute, each value gets a legend color (override or dark default).
 */
export function nodeTextColor(
  node: GraphNodeDto,
  textKey: string,
  colorMap: Record<string, string> | undefined,
  borderKey: string,
  borderColorMap?: Record<string, string>,
  fillKey?: string,
  fillColorMap?: Record<string, string>
): string {
  const value = nodePropValue(node, textKey);
  if (value && colorMap?.[value]) return colorMap[value];
  const usesBorderColor = textKey === borderKey || !value || textKey === NODE_TYPE_COLOR_KEY;
  if (usesBorderColor) {
    return darkenColor(
      nodeBorderColor(
        node,
        textKey === borderKey ? borderKey : NODE_TYPE_COLOR_KEY,
        borderColorMap,
        fillKey,
        fillColorMap
      ),
      TEXT_DARKEN_AMOUNT
    );
  }
  return textFromFill(defaultNodeFill(textKey, value));
}

export function nodeTextColorForValue(
  textKey: string,
  value: string,
  colorMap?: Record<string, string>
): string {
  if (colorMap?.[value]) return colorMap[value];
  if (textKey === NODE_TYPE_COLOR_KEY) return darkenColor(typeBorderColor(value), TEXT_DARKEN_AMOUNT);
  return textFromFill(defaultNodeFill(textKey, value));
}

export function nodeFillColorForValue(
  propertyKey: string,
  value: string,
  colorMap?: Record<string, string>
): string {
  return overrideOr(colorMap, value, defaultNodeFill(propertyKey, value));
}

export function nodeBorderColorForValue(
  propertyKey: string,
  value: string,
  colorMap?: Record<string, string>,
  fillKey?: string,
  fillColorMap?: Record<string, string>
): string {
  if (fillKey && fillKey === propertyKey) {
    if (colorMap?.[value]) return colorMap[value];
    return borderFromFill(nodeFillColorForValue(fillKey, value, fillColorMap));
  }
  if (propertyKey === NODE_TYPE_COLOR_KEY) {
    return overrideOr(colorMap, value, typeBorderColor(value));
  }
  return overrideOr(colorMap, value, edgeColorForProperty(value, 'Application', propertyKey));
}

/** Persist a color for a channel; mirror stroke↔label or fill→(derived border) when shared. */
export function setRationalizedColorInMaps(
  colors: LegendColorMaps,
  channel: keyof LegendColorMaps,
  value: string,
  color: string,
  edgeColorKey: string,
  edgeLabelKey: string,
  appFillKey: string,
  appBorderKey: string
): LegendColorMaps {
  let next = setColorInMaps(colors, channel, value, color);
  // Label text color follows stroke — only persist stroke when channels share a key.
  if (channel === 'edgeStroke' && edgeColorKey === edgeLabelKey) {
    next = setColorInMaps(next, 'edgeStroke', value, color);
  }
  if (channel === 'appFill' && appFillKey === appBorderKey) {
    next = setColorInMaps(next, 'appFill', value, color);
    // border derived at paint time — clear stale explicit border override
    if (next.appBorder?.[value]) {
      const { [value]: _, ...rest } = next.appBorder;
      next = { ...next, appBorder: rest };
    }
  }
  return next;
}

export function collectLegendColorValues(
  edges: GraphEdgeDto[],
  propertyKey: string
): string[] {
  const values = edges
    .map((e) => edgeColorValue(e, propertyKey))
    .filter((v): v is string => Boolean(v?.trim()));

  if (propertyKey === RELATION_TYPE_COLOR_KEY) {
    const order = Object.keys(EDGE_TYPE_STYLES) as EdgeTypeKey[];
    const present = new Set(values);
    const known = order.filter((k) => present.has(k));
    const unknown = [...present].filter((k) => !order.includes(k as EdgeTypeKey)).sort();
    return [...known, ...unknown];
  }
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function collectNodeLegendValues(
  nodes: GraphNodeDto[],
  propertyKey: string
): string[] {
  if (propertyKey === NODE_TYPE_COLOR_KEY) {
    return [...new Set(nodes.map((n) => n.type).filter(Boolean))].sort();
  }
  if (propertyKey === NODE_LABEL_COLOR_KEY) {
    return [...new Set(nodes.map((node) => node.label?.trim()).filter((label): label is string => Boolean(label)))].sort(
      (left, right) => left.localeCompare(right),
    );
  }
  const values: string[] = [];
  for (const node of nodes) {
    const references = referenceValues(node, propertyKey);
    if (references.length > 0) {
      values.push(...references);
      continue;
    }
    const text = nodePropValue(node, propertyKey);
    if (text?.trim()) values.push(text);
  }
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function nodeColorValueCounts(nodes: GraphNodeDto[]): ColorValueCount[] {
  return discoverNodePropertyKeys(nodes).map((key) => {
    const values = nodes
      .map((node) => nodePropValue(node, key))
      .filter((value): value is string => Boolean(value));
    return { key, distinct: new Set(values).size, covered: values.length };
  });
}

function nodeSpreadCounts(nodes: GraphNodeDto[]): ColorValueCount[] {
  const labels = nodes
    .map((node) => node.label?.trim())
    .filter((label): label is string => Boolean(label));
  return [
    ...nodeColorValueCounts(nodes),
    { key: NODE_LABEL_COLOR_KEY, distinct: new Set(labels).size, covered: labels.length },
  ];
}

export function edgeColorValueCounts(edges: GraphEdgeDto[]): ColorValueCount[] {
  return discoverColorPropertyKeys(edges).map((key) => {
    const values = edges
      .map((edge) => edgeColorValue(edge, key))
      .filter((value): value is string => Boolean(value));
    return { key, distinct: new Set(values).size, covered: values.length };
  });
}

function untouchedNodeChannel(input: {
  storedKey: string;
  nodes: GraphNodeDto[];
  userChose: boolean;
  hasCustomColor: boolean;
  counts: readonly ColorValueCount[];
}): string {
  return resolveUntouchedColorKey({
    storedKey: resolveNodePropertyKey(input.storedKey, input.nodes),
    sentinel: NODE_TYPE_COLOR_KEY,
    userChose: input.userChose,
    hasCustomColor: input.hasCustomColor,
    counts: input.counts,
    paletteSize: PASTEL_NODE_PALETTE.length,
    population: input.nodes.length,
  });
}

export function resolveSpreadColorKeys(input: {
  nodes: GraphNodeDto[];
  edges: GraphEdgeDto[];
  fillKey: string;
  borderKey: string;
  textKey?: string;
  strokeKey: string;
  fillChosen: boolean;
  borderChosen: boolean;
  textChosen?: boolean;
  strokeChosen: boolean;
  colors?: LegendColorMaps;
}): { fillKey: string; borderKey: string; textKey: string; strokeKey: string } {
  const fillCounts = nodeSpreadCounts(input.nodes);
  const fillKey = untouchedNodeChannel({
    storedKey: input.fillKey,
    nodes: input.nodes,
    userChose: input.fillChosen,
    hasCustomColor: hasCustomColor(input.colors?.appFill),
    counts: fillCounts,
  });
  const borderKey = resolveMirroredKey({
    storedKey: resolveNodePropertyKey(input.borderKey, input.nodes),
    mirrorKey: fillKey,
    userChose: input.borderChosen,
  });
  return {
    fillKey,
    borderKey,
    textKey: resolveMirroredKey({
      storedKey: resolveNodePropertyKey(input.textKey ?? borderKey, input.nodes),
      mirrorKey: borderKey,
      userChose: input.textChosen ?? false,
    }),
    strokeKey: resolveUntouchedColorKey({
      storedKey: resolveColorPropertyKey(input.strokeKey, input.edges),
      sentinel: RELATION_TYPE_COLOR_KEY,
      userChose: input.strokeChosen,
      hasCustomColor: hasCustomColor(input.colors?.edgeStroke),
      counts: edgeColorValueCounts(input.edges),
      paletteSize: DARK_EDGE_PALETTE.length,
      population: input.edges.length,
    }),
  };
}

/** Label follows stroke until the user picks a label property (or hide-labels). */
export function resolveMirroredLabelKey(input: {
  storedKey: string;
  strokeKey: string;
  userChose: boolean;
  edges: GraphEdgeDto[];
}): string {
  return resolveMirroredKey({
    storedKey: resolveColorPropertyKey(input.storedKey, input.edges),
    mirrorKey: input.strokeKey,
    userChose: input.userChose,
  });
}

export function legendLabelForColorValue(propertyKey: string, value: string): string {
  if (propertyKey === RELATION_TYPE_COLOR_KEY) {
    return (EDGE_TYPE_STYLES as Record<string, { legendLabel: string } | undefined>)[value]
      ?.legendLabel ?? value;
  }
  if (propertyKey === NODE_TYPE_COLOR_KEY) {
    return value === 'Application' ? 'App' : value;
  }
  return value;
}

export function strokeColorForLegendSwatch(
  propertyKey: string,
  value: string,
  relationFallback = 'DEPENDS_ON',
  colorMap?: Record<string, string>
): string {
  return paintEdgeStrokeColor(value, relationFallback, propertyKey, colorMap);
}

export function setColorInMaps(
  colors: LegendColorMaps,
  channel: keyof LegendColorMaps,
  value: string,
  color: string
): LegendColorMaps {
  const prev = colors[channel] ?? {};
  return {
    ...colors,
    [channel]: { ...prev, [value]: color },
  };
}

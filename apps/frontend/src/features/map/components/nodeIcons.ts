import type { GraphNodeDto } from '@/types/api';
import { nodePropValue } from './edgeColorProperty.ts';

/** Attribute choice meaning "no icons on nodes" (the default). */
export const NODE_ICON_NONE_KEY = '__none__';

/** Label text scale once icons share the box with the name. */
const LABEL_SCALE_WITH_ICONS = 0.85;

type NodeIconOption = { key: string; label: string };

export const NODE_ICON_CATALOG: NodeIconOption[] = [
  { key: 'server', label: 'Server' },
  { key: 'database', label: 'Database' },
  { key: 'cloud', label: 'Cloud' },
  { key: 'cloud-cog', label: 'Cloud Cog' },
  { key: 'hard-drive', label: 'Hard Drive' },
  { key: 'cpu', label: 'Cpu' },
  { key: 'network', label: 'Network' },
  { key: 'globe', label: 'Globe' },
  { key: 'lock', label: 'Lock' },
  { key: 'shield-check', label: 'Shield Check' },
  { key: 'shield', label: 'Shield' },
  { key: 'key-round', label: 'Key Round' },
  { key: 'users', label: 'Users' },
  { key: 'user', label: 'User' },
  { key: 'user-cog', label: 'User Cog' },
  { key: 'building-2', label: 'Building 2' },
  { key: 'landmark', label: 'Landmark' },
  { key: 'briefcase', label: 'Briefcase' },
  { key: 'wallet', label: 'Wallet' },
  { key: 'banknote', label: 'Banknote' },
  { key: 'credit-card', label: 'Credit Card' },
  { key: 'coins', label: 'Coins' },
  { key: 'piggy-bank', label: 'Piggy Bank' },
  { key: 'receipt', label: 'Receipt' },
  { key: 'calculator', label: 'Calculator' },
  { key: 'chart-bar', label: 'Chart Bar' },
  { key: 'chart-line', label: 'Chart Line' },
  { key: 'chart-pie', label: 'Chart Pie' },
  { key: 'trending-up', label: 'Trending Up' },
  { key: 'activity', label: 'Activity' },
  { key: 'gauge', label: 'Gauge' },
  { key: 'file-text', label: 'File Text' },
  { key: 'file-spreadsheet', label: 'File Spreadsheet' },
  { key: 'folder', label: 'Folder' },
  { key: 'mail', label: 'Mail' },
  { key: 'message-square', label: 'Message Square' },
  { key: 'bell', label: 'Bell' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'clock', label: 'Clock' },
  { key: 'package', label: 'Package' },
  { key: 'truck', label: 'Truck' },
  { key: 'shopping-cart', label: 'Shopping Cart' },
  { key: 'store', label: 'Store' },
  { key: 'factory', label: 'Factory' },
  { key: 'wrench', label: 'Wrench' },
  { key: 'settings', label: 'Settings' },
  { key: 'terminal', label: 'Terminal' },
  { key: 'code', label: 'Code' },
  { key: 'braces', label: 'Braces' },
  { key: 'git-branch', label: 'Git Branch' },
  { key: 'layers', label: 'Layers' },
  { key: 'box', label: 'Box' },
  { key: 'boxes', label: 'Boxes' },
  { key: 'workflow', label: 'Workflow' },
  { key: 'zap', label: 'Zap' },
  { key: 'rocket', label: 'Rocket' },
  { key: 'star', label: 'Star' },
  { key: 'heart', label: 'Heart' },
  { key: 'flag', label: 'Flag' },
  { key: 'bookmark', label: 'Bookmark' },
  { key: 'tag', label: 'Tag' },
  { key: 'search', label: 'Search' },
  { key: 'eye', label: 'Eye' },
  { key: 'scale', label: 'Scale' },
  { key: 'gavel', label: 'Gavel' },
  { key: 'file-check', label: 'File Check' },
  { key: 'clipboard-list', label: 'Clipboard List' },
  { key: 'cable', label: 'Cable' },
  { key: 'wifi', label: 'Wifi' },
  { key: 'smartphone', label: 'Smartphone' },
  { key: 'monitor', label: 'Monitor' },
  { key: 'laptop', label: 'Laptop' },
  { key: 'printer', label: 'Printer' },
  { key: 'radio', label: 'Radio' },
  { key: 'satellite', label: 'Satellite' },
  { key: 'bot', label: 'Bot' },
  { key: 'brain', label: 'Brain' },
  { key: 'sparkles', label: 'Sparkles' },
  { key: 'lightbulb', label: 'Lightbulb' },
  { key: 'target', label: 'Target' },
  { key: 'puzzle', label: 'Puzzle' },
  { key: 'link', label: 'Link' },
  { key: 'share-2', label: 'Share 2' },
  { key: 'repeat', label: 'Repeat' },
  { key: 'refresh-cw', label: 'Refresh Cw' },
  { key: 'arrow-left-right', label: 'Arrow Left Right' },
  { key: 'inbox', label: 'Inbox' },
  { key: 'archive', label: 'Archive' },
  { key: 'map', label: 'Map' },
  { key: 'compass', label: 'Compass' },
  { key: 'anchor', label: 'Anchor' },
  { key: 'plane', label: 'Plane' },
  { key: 'leaf', label: 'Leaf' },
  { key: 'flame', label: 'Flame' },
  { key: 'droplet', label: 'Droplet' },
  { key: 'sun', label: 'Sun' },
  { key: 'moon', label: 'Moon' },
  { key: 'badge-check', label: 'Badge Check' },
  { key: 'fingerprint', label: 'Fingerprint' },
  { key: 'scan', label: 'Scan' },
  { key: 'qr-code', label: 'Qr Code' },
];

export function nodeLabelScale(hasIcons: boolean): number {
  return hasIcons ? LABEL_SCALE_WITH_ICONS : 1;
}

/** Spread the values over the catalog so each starts with its own icon. */
export function defaultIconForValue(values: string[], value: string): string {
  const index = Math.max(0, values.indexOf(value));
  return NODE_ICON_CATALOG[index % NODE_ICON_CATALOG.length].key;
}

/** Icon shown on a node: the user's pick for its attribute value, else a default. Null hides it. */
export function nodeIconKeyFor(
  node: GraphNodeDto,
  coding: { attributeKey: string; iconByValue: Record<string, string>; values: string[] },
): string | null {
  const { attributeKey, iconByValue, values } = coding;
  if (attributeKey === NODE_ICON_NONE_KEY) return null;
  const value = nodePropValue(node, attributeKey);
  if (!value) return null;
  return iconByValue[value] ?? defaultIconForValue(values, value);
}

const NODE_ICON_ATTRIBUTE_STORAGE_KEY = 'flowra.graph.nodeIconAttribute';
const NODE_ICON_MAP_STORAGE_KEY = 'flowra.graph.nodeIconMap';

export function loadNodeIconAttribute(): string {
  try {
    return localStorage.getItem(NODE_ICON_ATTRIBUTE_STORAGE_KEY) ?? NODE_ICON_NONE_KEY;
  } catch {
    return NODE_ICON_NONE_KEY;
  }
}

export function loadNodeIconMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(NODE_ICON_MAP_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function storeNodeIcons(attributeKey: string, iconByValue: Record<string, string>): void {
  try {
    localStorage.setItem(NODE_ICON_ATTRIBUTE_STORAGE_KEY, attributeKey);
    localStorage.setItem(NODE_ICON_MAP_STORAGE_KEY, JSON.stringify(iconByValue));
  } catch {
    // Private browsing or full storage: icons just stay for this session.
  }
}

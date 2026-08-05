import type { Edge } from '@xyflow/react';
import type { GraphEdgeDto, GraphNodeDto } from '@/types/api';
import type { AppNode } from '../hooks/useGraphData';
import type { OrientedEdgeType } from '../components/OrientedEdge';

export const MAX_OPEN_SANDBOXES = 4;
export const SANDBOX_SAVED_STORAGE_KEY = 'flowra.sandbox.savedDocuments';

export type SandboxLayoutMode = 'horizontal' | 'vertical' | 'square';

export type SandboxIcon = {
  id: string;
  iconKey: string;
  legendLabel: string;
  x: number;
  y: number;
};

/** Serializable sandbox graph (display-only overrides; never writes Neo4j attrs). */
export type SandboxDocument = {
  id: string;
  name: string;
  dirty: boolean;
  graphNodes: GraphNodeDto[];
  graphEdges: GraphEdgeDto[];
  nodes: AppNode[];
  edges: OrientedEdgeType[];
  icons: SandboxIcon[];
  /** Display-only label overrides (node id → text). */
  nodeLabelOverrides: Record<string, string>;
  /** Display-only label overrides (edge id → text). */
  edgeLabelOverrides: Record<string, string>;
  /** Local-only collapsed apps (same idea as Production hide). */
  hiddenNodeIds: string[];
};

export type SavedSandboxMeta = {
  id: string;
  name: string;
  updatedAt: string;
  document: SandboxDocument;
};

export type SandboxIconDef = {
  key: string;
  label: string;
  keywords?: string;
};

/** Flat business-oriented emoji palette (filterable in Toolkit Icons). */
export const SANDBOX_ICON_PALETTE: SandboxIconDef[] = [
  { key: '🏢', label: 'Building', keywords: 'office company hq' },
  { key: '🏭', label: 'Factory', keywords: 'plant industry manufacturing' },
  { key: '🏪', label: 'Store', keywords: 'shop retail' },
  { key: '🏛️', label: 'Bank', keywords: 'finance institution government' },
  { key: '👥', label: 'Users', keywords: 'people team group' },
  { key: '👤', label: 'User', keywords: 'person employee' },
  { key: '🤝', label: 'Handshake', keywords: 'deal partner agreement' },
  { key: '💼', label: 'Briefcase', keywords: 'work business job' },
  { key: '📊', label: 'Chart', keywords: 'analytics stats report' },
  { key: '📈', label: 'Growth', keywords: 'trend up analytics' },
  { key: '📉', label: 'Decline', keywords: 'trend down' },
  { key: '💰', label: 'Money', keywords: 'cash finance revenue' },
  { key: '💳', label: 'Card', keywords: 'payment credit' },
  { key: '🧾', label: 'Invoice', keywords: 'receipt bill' },
  { key: '💱', label: 'Exchange', keywords: 'currency forex' },
  { key: '☁️', label: 'Cloud', keywords: 'saas aws azure' },
  { key: '💻', label: 'Laptop', keywords: 'computer device' },
  { key: '🖥️', label: 'Desktop', keywords: 'computer workstation' },
  { key: '📱', label: 'Phone', keywords: 'mobile device' },
  { key: '💾', label: 'Server', keywords: 'host infrastructure storage' },
  { key: '🗄️', label: 'Database', keywords: 'data storage db' },
  { key: '🔌', label: 'Plugin', keywords: 'integration connect' },
  { key: '🔗', label: 'Link', keywords: 'connection url' },
  { key: '🔒', label: 'Lock', keywords: 'security private' },
  { key: '🔑', label: 'Key', keywords: 'access credential' },
  { key: '🛡️', label: 'Shield', keywords: 'security protect' },
  { key: '⚠️', label: 'Warning', keywords: 'alert risk' },
  { key: '✅', label: 'Check', keywords: 'ok done success' },
  { key: '❌', label: 'Cross', keywords: 'error fail stop' },
  { key: '⭐', label: 'Star', keywords: 'favorite important' },
  { key: '📌', label: 'Pin', keywords: 'mark note' },
  { key: '🏷️', label: 'Tag', keywords: 'label category' },
  { key: '💡', label: 'Idea', keywords: 'light innovation' },
  { key: '🎯', label: 'Target', keywords: 'goal kpi' },
  { key: '🚀', label: 'Rocket', keywords: 'launch growth' },
  { key: '📅', label: 'Calendar', keywords: 'date schedule' },
  { key: '⏰', label: 'Clock', keywords: 'time deadline' },
  { key: '📧', label: 'Mail', keywords: 'email message' },
  { key: '📞', label: 'Call', keywords: 'phone contact' },
  { key: '💬', label: 'Chat', keywords: 'message talk' },
  { key: '📄', label: 'Document', keywords: 'file paper' },
  { key: '📁', label: 'Folder', keywords: 'files directory' },
  { key: '📦', label: 'Package', keywords: 'box delivery product' },
  { key: '🚚', label: 'Truck', keywords: 'logistics shipping' },
  { key: '🌍', label: 'Globe', keywords: 'world global international' },
  { key: '🗺️', label: 'Map', keywords: 'location geography' },
  { key: '📍', label: 'Location', keywords: 'pin place' },
  { key: '🛒', label: 'Cart', keywords: 'ecommerce shop' },
  { key: '⚙️', label: 'Settings', keywords: 'gear config' },
  { key: '🔧', label: 'Wrench', keywords: 'tools maintenance' },
  { key: '🛠️', label: 'Tools', keywords: 'build fix' },
  { key: '📡', label: 'Antenna', keywords: 'network signal api' },
  { key: '🧩', label: 'Puzzle', keywords: 'module component' },
  { key: '🔁', label: 'Sync', keywords: 'refresh cycle process' },
  { key: '⏸️', label: 'Pause', keywords: 'hold stop' },
  { key: '▶️', label: 'Play', keywords: 'start run' },
  { key: '🔔', label: 'Bell', keywords: 'notification alert' },
  { key: '📝', label: 'Note', keywords: 'write edit' },
  { key: '📋', label: 'Clipboard', keywords: 'list checklist' },
  { key: '🧠', label: 'Brain', keywords: 'ai ml intelligence' },
  { key: '🤖', label: 'Robot', keywords: 'ai automation bot' },
  { key: '🌐', label: 'Web', keywords: 'internet www' },
  { key: '🪪', label: 'ID', keywords: 'badge identity' },
  { key: '📐', label: 'Ruler', keywords: 'measure design' },
  { key: '🔬', label: 'Science', keywords: 'lab research' },
  { key: '🏥', label: 'Hospital', keywords: 'health medical' },
  { key: '🎓', label: 'Education', keywords: 'school learning' },
  { key: '⚖️', label: 'Legal', keywords: 'law compliance' },
  { key: '📣', label: 'Megaphone', keywords: 'marketing announce' },
];

export function sandboxIconLabel(iconKey: string): string {
  return SANDBOX_ICON_PALETTE.find((i) => i.key === iconKey)?.label ?? 'Icon';
}

export function createSandboxDocumentId(): string {
  return `sandbox-doc-${crypto.randomUUID()}`;
}

export function createSandboxIconId(): string {
  return `sandbox-icon-${crypto.randomUUID()}`;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Deep-clone current graph into an independent sandbox document. */
export function cloneIntoSandboxDocument(
  name: string,
  graphNodes: GraphNodeDto[],
  graphEdges: GraphEdgeDto[],
  nodes: AppNode[],
  edges: Edge[]
): SandboxDocument {
  return {
    id: createSandboxDocumentId(),
    name,
    dirty: false,
    graphNodes: cloneJson(graphNodes),
    graphEdges: cloneJson(graphEdges),
    nodes: cloneJson(nodes) as AppNode[],
    edges: cloneJson(edges) as OrientedEdgeType[],
    icons: [],
    nodeLabelOverrides: {},
    edgeLabelOverrides: {},
    hiddenNodeIds: [],
  };
}

/** Deep-clone an open sandbox into a new independent document. */
export function cloneSandboxDocument(source: SandboxDocument, name: string): SandboxDocument {
  const copy = cloneJson(source);
  return {
    ...copy,
    id: createSandboxDocumentId(),
    name,
    dirty: true,
    hiddenNodeIds: copy.hiddenNodeIds ?? [],
  };
}

/** Normalize older saved docs that may omit newer fields. */
export function normalizeSandboxDocument(doc: SandboxDocument): SandboxDocument {
  return {
    ...doc,
    icons: doc.icons ?? [],
    nodeLabelOverrides: doc.nodeLabelOverrides ?? {},
    edgeLabelOverrides: doc.edgeLabelOverrides ?? {},
    hiddenNodeIds: doc.hiddenNodeIds ?? [],
  };
}

export function loadSavedSandboxes(): SavedSandboxMeta[] {
  try {
    const raw = localStorage.getItem(SANDBOX_SAVED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedSandboxMeta[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function storeSavedSandboxes(items: SavedSandboxMeta[]): void {
  try {
    localStorage.setItem(SANDBOX_SAVED_STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

export function sandboxLayoutClass(mode: SandboxLayoutMode, count: number): string {
  if (count <= 1) return 'sandbox-board sandbox-board--single';
  return `sandbox-board sandbox-board--${mode} sandbox-board--n${Math.min(count, 4)}`;
}

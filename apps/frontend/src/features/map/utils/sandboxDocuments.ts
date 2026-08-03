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
};

export type SavedSandboxMeta = {
  id: string;
  name: string;
  updatedAt: string;
  document: SandboxDocument;
};

export const SANDBOX_ICON_PALETTE = ['⭐', '⚠️', '📌', '🔗', '💡', '🏷️'] as const;

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

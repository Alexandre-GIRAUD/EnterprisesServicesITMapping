import { useCallback, useEffect, useState } from 'react';
import type { Edge } from '@xyflow/react';
import type { GraphEdgeDto, GraphNodeDto } from '@/types/api';
import type { AppNode } from './useGraphData';
import {
  MAX_OPEN_SANDBOXES,
  cloneIntoSandboxDocument,
  cloneSandboxDocument,
  createSandboxIconId,
  loadSavedSandboxes,
  normalizeSandboxDocument,
  sandboxIconLabel,
  storeSavedSandboxes,
  type SandboxDocument,
  type SandboxIcon,
  type SandboxLayoutMode,
  type SavedSandboxMeta,
} from '../utils/sandboxDocuments';

type Seed = {
  graphNodes: GraphNodeDto[];
  graphEdges: GraphEdgeDto[];
  nodes: AppNode[];
  edges: Edge[];
};

export function useSandboxes() {
  const [openDocs, setOpenDocs] = useState<SandboxDocument[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [layout, setLayoutState] = useState<SandboxLayoutMode>('horizontal');
  const [saved, setSaved] = useState<SavedSandboxMeta[]>(() => loadSavedSandboxes());

  const activeDoc = openDocs.find((d) => d.id === activeId) ?? openDocs[0] ?? null;
  const anyDirty = openDocs.some((d) => d.dirty);

  // Square only makes sense with 3+ panes.
  useEffect(() => {
    if (openDocs.length === 2 && layout === 'square') {
      setLayoutState('horizontal');
    }
  }, [openDocs.length, layout]);

  const setLayout = useCallback((mode: SandboxLayoutMode) => {
    if (openDocs.length === 2 && mode === 'square') {
      setLayoutState('horizontal');
      return;
    }
    setLayoutState(mode);
  }, [openDocs.length]);

  const patchDoc = useCallback((id: string, patch: Partial<SandboxDocument> | ((d: SandboxDocument) => SandboxDocument)) => {
    setOpenDocs((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        const next = typeof patch === 'function' ? patch(d) : { ...d, ...patch };
        return next;
      })
    );
  }, []);

  const markDirty = useCallback((id: string) => {
    patchDoc(id, (d) => (d.dirty ? d : { ...d, dirty: true }));
  }, [patchDoc]);

  const openNew = useCallback((seed: Seed): string | null => {
    if (openDocs.length >= MAX_OPEN_SANDBOXES) return null;
    const n = openDocs.length + 1;
    const last = openDocs[openDocs.length - 1];
    const doc = last
      ? cloneSandboxDocument(last, `Sandbox ${n}`)
      : cloneIntoSandboxDocument(
          `Sandbox ${n}`,
          seed.graphNodes,
          seed.graphEdges,
          seed.nodes,
          seed.edges
        );
    setOpenDocs((prev) => [...prev, doc]);
    setActiveId(doc.id);
    return doc.id;
  }, [openDocs]);

  const duplicateDoc = useCallback((id: string): string | null => {
    if (openDocs.length >= MAX_OPEN_SANDBOXES) return null;
    const source = openDocs.find((d) => d.id === id);
    if (!source) return null;
    const doc = cloneSandboxDocument(source, `Sandbox ${openDocs.length + 1}`);
    setOpenDocs((prev) => [...prev, doc]);
    setActiveId(doc.id);
    return doc.id;
  }, [openDocs]);

  const ensureAtLeastOne = useCallback((seed: Seed) => {
    setOpenDocs((prev) => {
      if (prev.length > 0) return prev;
      const doc = cloneIntoSandboxDocument(
        'Sandbox 1',
        seed.graphNodes,
        seed.graphEdges,
        seed.nodes,
        seed.edges
      );
      setActiveId(doc.id);
      return [doc];
    });
  }, []);

  const closeDoc = useCallback((id: string) => {
    setOpenDocs((prev) => {
      const target = prev.find((d) => d.id === id);
      if (target?.dirty && !window.confirm('Close this sandbox? Unsaved changes will be lost.')) {
        return prev;
      }
      const next = prev.filter((d) => d.id !== id);
      setActiveId((cur) => {
        if (cur !== id) return cur;
        return next[0]?.id ?? null;
      });
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setOpenDocs([]);
    setActiveId(null);
  }, []);

  const saveDoc = useCallback((id: string, name?: string) => {
    let savedName = name;
    setOpenDocs((prev) => {
      const doc = prev.find((d) => d.id === id);
      if (!doc) return prev;
      const finalName = (savedName ?? doc.name).trim() || doc.name;
      savedName = finalName;
      const persisted: SandboxDocument = {
        ...normalizeSandboxDocument(doc),
        name: finalName,
        dirty: false,
      };
      const meta: SavedSandboxMeta = {
        id: doc.id,
        name: finalName,
        updatedAt: new Date().toISOString(),
        document: persisted,
      };
      setSaved((list) => {
        const next = [meta, ...list.filter((s) => s.id !== doc.id)];
        storeSavedSandboxes(next);
        return next;
      });
      return prev.map((d) => (d.id === id ? persisted : d));
    });
    return savedName;
  }, []);

  const loadSaved = useCallback((metaId: string): 'opened' | 'focused' | 'full' => {
    const meta = saved.find((s) => s.id === metaId);
    if (!meta) return 'full';
    const existing = openDocs.find((d) => d.id === meta.document.id);
    if (existing) {
      setActiveId(existing.id);
      return 'focused';
    }
    if (openDocs.length >= MAX_OPEN_SANDBOXES) return 'full';
    const doc = normalizeSandboxDocument({
      ...(JSON.parse(JSON.stringify(meta.document)) as SandboxDocument),
      dirty: false,
    });
    setOpenDocs((prev) => [...prev, doc]);
    setActiveId(doc.id);
    return 'opened';
  }, [openDocs, saved]);

  const deleteSaved = useCallback((metaId: string) => {
    setSaved((list) => {
      const next = list.filter((s) => s.id !== metaId);
      storeSavedSandboxes(next);
      return next;
    });
  }, []);

  const addIcon = useCallback((docId: string, iconKey: string, x: number, y: number) => {
    const icon: SandboxIcon = {
      id: createSandboxIconId(),
      iconKey,
      legendLabel: sandboxIconLabel(iconKey),
      x,
      y,
    };
    patchDoc(docId, (d) => ({
      ...d,
      dirty: true,
      icons: [...d.icons, icon],
    }));
  }, [patchDoc]);

  const updateIconLabel = useCallback((docId: string, iconId: string, legendLabel: string) => {
    patchDoc(docId, (d) => ({
      ...d,
      dirty: true,
      icons: d.icons.map((i) => (i.id === iconId ? { ...i, legendLabel } : i)),
    }));
  }, [patchDoc]);

  const removeIcon = useCallback((docId: string, iconId: string) => {
    patchDoc(docId, (d) => ({
      ...d,
      dirty: true,
      icons: d.icons.filter((i) => i.id !== iconId),
    }));
  }, [patchDoc]);

  const hideNode = useCallback((docId: string, nodeId: string) => {
    patchDoc(docId, (d) => {
      const hidden = d.hiddenNodeIds ?? [];
      if (hidden.includes(nodeId)) return d;
      return { ...d, dirty: true, hiddenNodeIds: [...hidden, nodeId] };
    });
  }, [patchDoc]);

  const showHidden = useCallback((docId: string, ids: string[]) => {
    if (ids.length === 0) return;
    const remove = new Set(ids);
    patchDoc(docId, (d) => ({
      ...d,
      dirty: true,
      hiddenNodeIds: (d.hiddenNodeIds ?? []).filter((id) => !remove.has(id)),
    }));
  }, [patchDoc]);

  return {
    openDocs,
    activeId,
    activeDoc,
    layout,
    setLayout,
    saved,
    anyDirty,
    setActiveId,
    openNew,
    duplicateDoc,
    ensureAtLeastOne,
    closeDoc,
    clearAll,
    patchDoc,
    markDirty,
    saveDoc,
    loadSaved,
    deleteSaved,
    addIcon,
    updateIconLabel,
    removeIcon,
    hideNode,
    showHidden,
  };
}

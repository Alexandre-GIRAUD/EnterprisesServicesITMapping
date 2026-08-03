import {
  Background,
  Controls,
  Panel,
  ReactFlow,
  type Edge,
  type EdgeTypes,
  type NodeTypes,
  type ReactFlowInstance,
} from '@xyflow/react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type SetStateAction,
} from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type {
  ApplicationResponse,
  GraphEdgeCreateResponse,
  GraphEdgeDto,
  GraphNodeFilterDto,
  GraphNodePosition,
  GraphSnapshotFilters,
  GraphSnapshotLegend,
} from '@/types/api';
import { fetchApplications } from '../api/applicationsApi';
import { fetchGraphNodeFilters } from '../api/graphApi';
import { createGraphSnapshot } from '../api/graphSnapshotsApi';
import { useGraphSnapshotsRefresh } from '../context/GraphSnapshotsContext';
import type { MapLocationState } from '../utils/mapNavigation';
import {
  buildAppNode,
  buildAppEdge,
  useGraphData,
  type AppNode,
  GRID,
  NODE_WIDTH,
  NODE_HEIGHT,
} from '../hooks/useGraphData';
import { useGraphFilters } from '../hooks/useGraphFilters';
import { useGraphMode } from '../hooks/useGraphMode';
import { useSandboxes } from '../hooks/useSandboxes';
import { WorkspaceDrawer } from './WorkspaceDrawer';
import { SandboxPane } from './SandboxPane';
import {
  MAX_OPEN_SANDBOXES,
  sandboxLayoutClass,
  type SandboxDocument,
} from '../utils/sandboxDocuments';
import type { OrientedEdgeType } from './OrientedEdge';
import { FilterDrawer } from './FilterDrawer';
import { ApplicationDetailsDrawer } from './ApplicationDetailsDrawer';
import { ApplicationsTablePanel } from './ApplicationsTablePanel';
import { FeedsTablePanel } from './FeedsTablePanel';
import { snapDraggedNodeForStraighterEdges } from './alignNodes';
import { GraphLegend } from './GraphLegend';
import { AppGraphNode } from './AppGraphNode';
import { OrientedEdge } from './OrientedEdge';
import { computeFocus } from './graphFocus';
import { applicationResponseFromGraphNode, isSandboxId } from '../utils/sandboxGraph';
import { ApplicationModuleGraph } from './ApplicationModuleGraph';
import type { ApplicationUpdatePatch } from './ApplicationDetailsDrawer';
import { SelfServiceBurger, SelfServiceSideMenu, type SideMenuTool } from './SelfServiceSideMenu';
import { GraphDisplayToggle, type GraphDisplayMode } from './GraphDisplayToggle';
import { TableContentToggle, type TableContentMode } from './TableContentToggle';
import { fitGraphView, ensureNodesVisible } from './fitGraphView';
import { GraphViewsPanel } from './GraphViewsPanel';
import { SaveSnapshotDialog } from './SaveSnapshotDialog';
import { PendingChangesPanel, pendingItemsCount } from './PendingChangesPanel';
import { ApplicationSearchBar } from './ApplicationSearchBar';
import { HiddenAppsPicker } from './HiddenAppsPicker';
import { listChangeDetections } from '../api/changeDetectionsApi';
import { GraphExportMenu } from './GraphExportMenu';
import {
  buildGraphExportFileName,
  exportGraphImage,
  type GraphImageFormat,
} from '../utils/exportGraphImage';
import {
  layoutCollapsedAppGraph,
  type NodePositionsMap,
} from './layoutCollapsedAppGraph';

type PendingViewRestore = {
  hiddenApplicationIds: string[];
  nodePositions: NodePositionsMap;
  legend?: GraphSnapshotLegend;
};

type SelectedApplication = {
  id: string;
  label: string;
};

/**
 * Application dependency graph (React Flow), backed by GET /api/graph.
 *
 * Composes three hooks: {@link useGraphMode} (normal / sandbox / views),
 * {@link useGraphFilters} (active filter set) and {@link useGraphData}
 * (fetch + layout). This component wires them to the drawers, React Flow
 * surface, mode tabs and the saved-views panel.
 */
export function GraphCanvas() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshSnapshots } = useGraphSnapshotsRefresh();
  const containerRef = useRef<HTMLDivElement>(null);
  const rfRef = useRef<ReactFlowInstance<AppNode, Edge> | null>(null);
  const nodeClickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastNodeClickRef = useRef<{ nodeId: string; time: number } | null>(null);
  const suppressClickAfterDragRef = useRef(false);
  const DOUBLE_CLICK_MS = 400;

  const [message, setMessage] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<SelectedApplication | null>(null);
  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState(false);
  const [applications, setApplications] = useState<ApplicationResponse[]>([]);
  const [nodeFilters, setNodeFilters] = useState<GraphNodeFilterDto[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  // Hover takes priority; if no hover, the pinned node keeps the highlight.
  const focusedId = hoveredId ?? pinnedId;
  const [graphReloadNonce, setGraphReloadNonce] = useState(0);
  const [pendingSandboxFilterHint, setPendingSandboxFilterHint] = useState(false);
  const [isSaveSnapshotOpen, setIsSaveSnapshotOpen] = useState(false);
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [displayMode, setDisplayMode] = useState<GraphDisplayMode>('graph');
  const [tableContent, setTableContent] = useState<TableContentMode>('apps');
  const [moduleGraphApp, setModuleGraphApp] = useState<{ id: string; label: string } | null>(null);
  const [activeSideMenuTool, setActiveSideMenuTool] = useState<SideMenuTool>('filters');
  const [pendingChangeCount, setPendingChangeCount] = useState(0);
  const [isExportingGraph, setIsExportingGraph] = useState(false);
  /** Local-only collapse set; tables keep using the full graph DTOs. */
  const hiddenNodeIdsRef = useRef<Set<string>>(new Set());
  /** Last canvas position of each hidden app (used when restoring without moving others). */
  const lastHiddenPositionsRef = useRef<NodePositionsMap>({});
  /** Drives re-render of the global “+” when the hidden set changes. */
  const [hiddenCount, setHiddenCount] = useState(0);
  const [hiddenIdsSnapshot, setHiddenIdsSnapshot] = useState<string[]>([]);
  /** Queued restore from My views — applied after graph fetch reaches ready. */
  const pendingViewRestoreRef = useRef<PendingViewRestore | null>(null);
  const prevGraphStatusRef = useRef<'loading' | 'ready' | 'error'>('loading');
  const collapseGenerationRef = useRef(0);
  const skipCollapseResetRef = useRef(true);
  const collapseHandlersRef = useRef<{
    hideNode: (nodeId: string) => void;
    expandHidden: (ids: string[]) => void;
  }>({
    hideNode: () => undefined,
    expandHidden: () => undefined,
  });

  const syncHiddenUi = useCallback((next: Set<string>) => {
    setHiddenCount(next.size);
    setHiddenIdsSnapshot([...next]);
  }, []);

  const setWorkspacePanelOpen = useCallback((value: SetStateAction<boolean>) => {
    if (typeof value === 'function') {
      setIsSideMenuOpen((open) => {
        const nextOpen = value(open);
        if (nextOpen) setActiveSideMenuTool('actions');
        return nextOpen ? true : open;
      });
      return;
    }
    if (value) {
      setActiveSideMenuTool('actions');
      setIsSideMenuOpen(true);
    }
  }, []);

  const setFilterPanelOpen = useCallback((value: SetStateAction<boolean>) => {
    setIsSideMenuOpen((open) => {
      const nextOpen = typeof value === 'function' ? value(open) : value;
      return nextOpen ? true : open;
    });
  }, []);

  const reloadGraph = useCallback(() => setGraphReloadNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    void listChangeDetections()
      .then((runs) => {
        if (!cancelled) setPendingChangeCount(pendingItemsCount(runs));
      })
      .catch(() => {
        if (!cancelled) setPendingChangeCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [graphReloadNonce]);

  const mode = useGraphMode({
    setMessage,
    setIsDrawerOpen: setWorkspacePanelOpen,
    setIsFilterDrawerOpen: setFilterPanelOpen,
    setIsDetailsDrawerOpen,
    reloadGraph,
  });
  const { graphMode, sandboxDirty, graphModeRef, isSandbox, isViewsMode } = mode;
  const sandboxes = useSandboxes();

  const filters = useGraphFilters({
    graphModeRef,
    setGraphMode: mode.setGraphMode,
    setSandboxDirty: mode.setSandboxDirty,
    setIsDrawerOpen: setWorkspacePanelOpen,
  });
  const {
    applicationIds,
    nodeAttributes,
    nodeRefs,
    edgeAttributes,
    filtersActive,
    applyGraphFilters,
    currentGraphFilters,
  } = filters;

  const hiddenNodeIdsForLegend = useMemo(
    () => new Set(hiddenIdsSnapshot),
    [hiddenIdsSnapshot]
  );

  const data = useGraphData({
    applicationIds,
    nodeAttributes,
    nodeRefs,
    edgeAttributes,
    filtersActive,
    graphReloadNonce,
    hiddenNodeIds: hiddenNodeIdsForLegend,
    graphModeRef,
    pendingSandboxFilterHint,
    setPendingSandboxFilterHint,
    setMessage,
    containerRef,
    rfRef,
  });
  const {
    nodes,
    setNodes,
    onNodesChange,
    edges,
    setEdges,
    onEdgesChange,
    status,
    graphNodes,
    setGraphNodes,
    graphEdges,
    setGraphEdges,
    simpleMode,
    colorPropertyKey,
    labelPropertyKey,
    appFillKey,
    appBorderKey,
    legendColors,
    hideEdgeLabels,
    handleColorPropertyChange,
    handleLabelPropertyChange,
    handleAppFillChange,
    handleAppBorderChange,
    handleValueColorChange,
    getLegendSnapshot,
    applyLegendSnapshot,
    legendColorPropertyOptions,
    legendLabelPropertyOptions,
    legendAppPropertyOptions,
    legendColorValues,
    legendLabelValues,
    legendLabelStrokeColors,
    legendFillValues,
    legendBorderValues,
    legendSetups,
    saveLegendSetup,
    applyLegendSetup,
    deleteLegendSetup,
  } = data;

  const legendCodingRef = useRef({
    colorPropertyKey,
    labelPropertyKey,
    appFillKey,
    appBorderKey,
    legendColors,
    hideEdgeLabels,
  });
  legendCodingRef.current = {
    colorPropertyKey,
    labelPropertyKey,
    appFillKey,
    appBorderKey,
    legendColors,
    hideEdgeLabels,
  };

  const showIndirectFlow = useMemo(
    () => edges.some((e) => Boolean((e as { data?: { indirect?: boolean } }).data?.indirect)),
    [edges]
  );

  useEffect(() => {
    mode.setSandboxDirty(sandboxes.anyDirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync dirty flag only
  }, [sandboxes.anyDirty]);

  const wasSandboxRef = useRef(false);
  useEffect(() => {
    if (isSandbox && status === 'ready' && sandboxes.openDocs.length === 0) {
      sandboxes.ensureAtLeastOne({
        graphNodes,
        graphEdges,
        nodes,
        edges,
      });
    }
    if (!isSandbox && wasSandboxRef.current) {
      sandboxes.clearAll();
    }
    wasSandboxRef.current = isSandbox;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- enter/leave sandbox only
  }, [isSandbox, status, sandboxes.openDocs.length]);

  const sandboxSeed = useCallback(
    () => ({
      graphNodes,
      graphEdges,
      nodes,
      edges,
    }),
    [graphNodes, graphEdges, nodes, edges]
  );

  const activeSandboxApps = useMemo(() => {
    const source = isSandbox
      ? (sandboxes.activeDoc?.graphNodes ?? graphNodes)
      : graphNodes;
    return source
      .filter((n) => n.type === 'Application')
      .map((n) => applicationResponseFromGraphNode(n));
  }, [isSandbox, sandboxes.activeDoc, graphNodes]);

  const graphAppsForDrawer = activeSandboxApps;

  const resolveSandboxApplication = useCallback(
    (id: string) => {
      const source = sandboxes.activeDoc?.graphNodes ?? graphNodes;
      const node = source.find((n) => n.id === id);
      if (!node) return null;
      return applicationResponseFromGraphNode(node);
    },
    [graphNodes, sandboxes.activeDoc]
  );

  function mutateActiveSandbox(mutator: (doc: SandboxDocument) => SandboxDocument) {
    const id = sandboxes.activeId ?? sandboxes.activeDoc?.id;
    if (!id) return;
    sandboxes.patchDoc(id, (d) => {
      const next = mutator(d);
      return { ...next, dirty: true };
    });
  }

  useEffect(() => {
    const state = location.state as MapLocationState | null;
    if (!state?.applySnapshot && !state?.graphMode && !state?.sideMenuTool) return;

    if (state.applySnapshot) {
      queueViewRestore(state.applySnapshot);
      applyGraphFilters(state.applySnapshot);
      reloadGraph();
    }

    if (state.graphMode === 'normal') {
      if (
        !sandboxDirty ||
        window.confirm('Leave sandbox? Local changes will be lost.')
      ) {
        mode.setGraphMode('normal');
        mode.setSandboxDirty(false);
        setWorkspacePanelOpen(false);
        setFilterPanelOpen(false);
        setIsDetailsDrawerOpen(false);
        reloadGraph();
      }
    } else if (state.graphMode === 'sandbox') {
      mode.setGraphMode('sandbox');
      mode.setSandboxDirty(false);
      setMessage('Sandbox — customize your graph, no changes saved.');
      setWorkspacePanelOpen(true);
    } else if (state.graphMode === 'views') {
      mode.setGraphMode('views');
      mode.setSandboxDirty(false);
      setWorkspacePanelOpen(false);
      setFilterPanelOpen(false);
      setIsDetailsDrawerOpen(false);
    }

    if (state.sideMenuTool) {
      setActiveSideMenuTool(state.sideMenuTool);
    }

    navigate('.', { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to navigation state only
  }, [location.state, applyGraphFilters, navigate, sandboxDirty]);

  function queueViewRestore(snapshot: GraphSnapshotFilters) {
    const positions: NodePositionsMap = {};
    const rawPositions = snapshot.nodePositions ?? {};
    for (const [id, pos] of Object.entries(rawPositions)) {
      if (
        pos &&
        typeof pos.x === 'number' &&
        typeof pos.y === 'number' &&
        Number.isFinite(pos.x) &&
        Number.isFinite(pos.y)
      ) {
        positions[id] = { x: pos.x, y: pos.y };
      }
    }
    pendingViewRestoreRef.current = {
      hiddenApplicationIds: [...(snapshot.hiddenApplicationIds ?? [])],
      nodePositions: positions,
      legend: snapshot.legend,
    };
  }

  async function handleSaveSnapshot(name: string) {
    const nodePositions: Record<string, GraphNodePosition> = {};
    for (const n of nodes) {
      nodePositions[n.id] = { x: n.position.x, y: n.position.y };
    }
    await createGraphSnapshot(name, {
      ...currentGraphFilters,
      hiddenApplicationIds: [...hiddenNodeIdsRef.current],
      nodePositions,
      legend: getLegendSnapshot(),
    });
    refreshSnapshots();
    setMessage(`View "${name}" saved.`);
  }

  const applySavedView = useCallback(
    (snapshotFilters: GraphSnapshotFilters) => {
      queueViewRestore(snapshotFilters);
      applyGraphFilters(snapshotFilters);
      reloadGraph();
    },
    [applyGraphFilters, reloadGraph]
  );

  const nodeTypes = useMemo<NodeTypes>(() => ({ app: AppGraphNode }), []);
  const edgeTypes = useMemo<EdgeTypes>(() => ({ oriented: OrientedEdge }), []);

  const captureVisiblePositions = useCallback((): NodePositionsMap => {
    const map: NodePositionsMap = {};
    const source = rfRef.current?.getNodes() ?? nodes;
    for (const n of source) {
      map[n.id] = { x: n.position.x, y: n.position.y };
    }
    return map;
  }, [nodes]);

  const relayoutCollapsed = useCallback(
    async (
      nextHidden: ReadonlySet<string>,
      nodePositions?: NodePositionsMap,
      options?: { fitView?: boolean; ensureVisibleNodeIds?: string[] }
    ) => {
      if (status !== 'ready' || graphNodes.length === 0) return;
      const gen = ++collapseGenerationRef.current;
      const rect = containerRef.current?.getBoundingClientRect();
      const aspectRatio = rect && rect.height > 0 ? rect.width / rect.height : 16 / 9;
      const coding = legendCodingRef.current;
      const laid = await layoutCollapsedAppGraph({
        graphNodes,
        graphEdges,
        hiddenNodeIds: nextHidden,
        colorPropertyKey: coding.colorPropertyKey,
        labelPropertyKey: coding.labelPropertyKey,
        nodeCoding: {
          appFillKey: coding.appFillKey,
          appBorderKey: coding.appBorderKey,
          colors: coding.legendColors,
        },
        colors: coding.legendColors,
        hideEdgeLabels: coding.hideEdgeLabels,
        aspectRatio,
        nodePositions,
        handlers: {
          onHideNode: (id) => collapseHandlersRef.current.hideNode(id),
          onExpandHidden: (ids) => collapseHandlersRef.current.expandHidden(ids),
        },
      });
      if (gen !== collapseGenerationRef.current) return;
      setNodes(laid.nodes);
      setEdges(laid.edges);
      if (options?.fitView) {
        window.setTimeout(() => fitGraphView(rfRef.current, { duration: 200 }), 40);
      } else if (options?.ensureVisibleNodeIds && options.ensureVisibleNodeIds.length > 0) {
        const ids = options.ensureVisibleNodeIds;
        const hints = laid.nodes.filter((n) => ids.includes(n.id));
        window.setTimeout(() => {
          ensureNodesVisible(rfRef.current, containerRef.current, ids, { nodeHints: hints });
        }, 40);
      }
    },
    [status, graphNodes, graphEdges, setNodes, setEdges]
  );

  const hideNode = useCallback(
    (nodeId: string) => {
      if (hiddenNodeIdsRef.current.has(nodeId)) return;
      const preserved = captureVisiblePositions();
      const hidingPos = preserved[nodeId];
      if (hidingPos) {
        lastHiddenPositionsRef.current[nodeId] = hidingPos;
      }
      const next = new Set(hiddenNodeIdsRef.current);
      next.add(nodeId);
      hiddenNodeIdsRef.current = next;
      syncHiddenUi(next);
      setHoveredId((prev) => (prev === nodeId ? null : prev));
      setPinnedId((prev) => (prev === nodeId ? null : prev));
      void relayoutCollapsed(next, preserved);
    },
    [captureVisiblePositions, relayoutCollapsed, syncHiddenUi]
  );

  const expandHidden = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const next = new Set(hiddenNodeIdsRef.current);
      const restoredIds: string[] = [];
      for (const id of ids) {
        if (next.delete(id)) restoredIds.push(id);
      }
      if (restoredIds.length === 0) return;
      const preserved = captureVisiblePositions();
      for (const id of restoredIds) {
        const cached = lastHiddenPositionsRef.current[id];
        if (cached) preserved[id] = cached;
      }
      hiddenNodeIdsRef.current = next;
      syncHiddenUi(next);
      void relayoutCollapsed(next, preserved, { ensureVisibleNodeIds: restoredIds });
    },
    [captureVisiblePositions, relayoutCollapsed, syncHiddenUi]
  );

  const hiddenAppOptions = useMemo(() => {
    const labels = new Map<string, string>();
    for (const node of graphNodes) {
      labels.set(node.id, node.label);
    }
    for (const app of applications) {
      if (!labels.has(app.id)) labels.set(app.id, app.name);
    }
    return hiddenIdsSnapshot.map((id) => ({
      id,
      label: labels.get(id) ?? id,
    }));
  }, [hiddenIdsSnapshot, graphNodes, applications]);

  collapseHandlersRef.current = { hideNode, expandHidden };

  // Reset collapse on mode change / graph reload — but keep a pending view restore.
  useEffect(() => {
    if (skipCollapseResetRef.current) {
      skipCollapseResetRef.current = false;
      return;
    }
    collapseGenerationRef.current += 1;
    if (pendingViewRestoreRef.current != null) {
      hiddenNodeIdsRef.current = new Set();
      lastHiddenPositionsRef.current = {};
      syncHiddenUi(new Set());
      return;
    }
    const hadHidden = hiddenNodeIdsRef.current.size > 0;
    hiddenNodeIdsRef.current = new Set();
    lastHiddenPositionsRef.current = {};
    if (hadHidden) {
      syncHiddenUi(new Set());
      void relayoutCollapsed(new Set());
    }
  }, [graphMode, graphReloadNonce, relayoutCollapsed, syncHiddenUi]);

  // Apply queued My-views restore only on loading→ready (avoids applying to the stale graph).
  useEffect(() => {
    const prevStatus = prevGraphStatusRef.current;
    prevGraphStatusRef.current = status;

    if (status === 'error' && pendingViewRestoreRef.current != null) {
      pendingViewRestoreRef.current = null;
      return;
    }

    if (status !== 'ready' || prevStatus !== 'loading') return;

    const pending = pendingViewRestoreRef.current;
    if (pending == null) return;
    pendingViewRestoreRef.current = null;

    const existing = new Set(graphNodes.map((n) => n.id));
    const nextHidden = new Set(
      pending.hiddenApplicationIds.filter((id) => existing.has(id))
    );
    const nextPositions: NodePositionsMap = {};
    for (const [id, pos] of Object.entries(pending.nodePositions)) {
      if (existing.has(id) && !nextHidden.has(id)) {
        nextPositions[id] = pos;
      }
    }

    hiddenNodeIdsRef.current = nextHidden;
    syncHiddenUi(nextHidden);
    lastHiddenPositionsRef.current = {};
    if (pending.legend) {
      applyLegendSnapshot(pending.legend);
      // Keep collapse layout in sync — React state from apply is not committed yet.
      legendCodingRef.current = {
        colorPropertyKey: pending.legend.edgeColorKey || legendCodingRef.current.colorPropertyKey,
        labelPropertyKey: pending.legend.edgeLabelKey || legendCodingRef.current.labelPropertyKey,
        appFillKey: pending.legend.appFillKey || legendCodingRef.current.appFillKey,
        appBorderKey: pending.legend.appBorderKey || legendCodingRef.current.appBorderKey,
        legendColors: pending.legend.colors ?? {},
        hideEdgeLabels: Boolean(pending.legend.hideEdgeLabels),
      };
    }
    void relayoutCollapsed(
      nextHidden,
      Object.keys(nextPositions).length > 0 ? nextPositions : undefined,
      { fitView: true }
    );
  }, [status, graphNodes, graphEdges, relayoutCollapsed, syncHiddenUi, applyLegendSnapshot]);

  // Focus neighborhood for hover/selection dimming (null = nothing focused).
  const focus = useMemo(
    () => (focusedId ? computeFocus(edges, focusedId) : null),
    [edges, focusedId]
  );

  const displayNodes = useMemo(() => {
    return nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        onHide:
          n.data.nodeType === 'Application'
            ? () => collapseHandlersRef.current.hideNode(n.id)
            : undefined,
      },
      className: focus
        ? `graph-node ${focus.nodeIds.has(n.id) ? 'is-focus' : 'is-faded'}`
        : n.className,
    }));
  }, [nodes, focus]);

  const displayEdges = useMemo(() => {
    if (!focus) return edges;
    return edges.map((e) => ({
      ...e,
      className: focus.edgeIds.has(e.id) ? 'is-focus' : 'is-faded',
    }));
  }, [edges, focus]);

  const openApplicationDetails = useCallback((id: string, label: string) => {
    setSelectedApplication({ id, label });
    setIsDetailsDrawerOpen(true);
  }, []);

  const refreshApplications = useCallback(async () => {
    try {
      const rows = await fetchApplications();
      setApplications(rows);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshNodeFilters = useCallback(async () => {
    try {
      setNodeFilters(await fetchGraphNodeFilters());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refreshApplications();
    void refreshNodeFilters();
  }, [refreshApplications, refreshNodeFilters]);

  // Escape closes the application details drawer.
  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDetailsDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, []);

  const clearPendingNodeClick = useCallback(() => {
    if (nodeClickTimeoutRef.current) {
      clearTimeout(nodeClickTimeoutRef.current);
      nodeClickTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (displayMode === 'table') setModuleGraphApp(null);
  }, [displayMode]);

  useEffect(() => {
    return () => clearPendingNodeClick();
  }, [clearPendingNodeClick]);

  const openModuleGraphById = useCallback(
    (applicationId: string, label?: string) => {
      if (isSandboxId(applicationId)) return;
      clearPendingNodeClick();
      lastNodeClickRef.current = null;
      setIsDetailsDrawerOpen(false);
      setModuleGraphApp({ id: applicationId, label: label ?? applicationId });
      setDisplayMode('graph');
    },
    [clearPendingNodeClick]
  );

  useEffect(() => {
    const state = location.state as MapLocationState | null;
    const appId = state?.openModuleGraphId?.trim();
    if (!appId) return;

    openModuleGraphById(appId, state?.openModuleGraphLabel?.trim() || undefined);
    navigate('.', { replace: true, state: {} });
  }, [location.state, navigate, openModuleGraphById]);

  const openModuleGraph = useCallback(
    (node: AppNode) => {
      if (node.data.nodeType !== 'Application') return;
      openModuleGraphById(node.id, node.data.label ?? node.id);
    },
    [openModuleGraphById]
  );

  const handleNodeClick = useCallback(
    (event: ReactMouseEvent, node: AppNode) => {
      if (suppressClickAfterDragRef.current) return;

      const now = Date.now();
      const last = lastNodeClickRef.current;
      if (last && last.nodeId === node.id && now - last.time < DOUBLE_CLICK_MS) {
        lastNodeClickRef.current = null;
        openModuleGraph(node);
        return;
      }
      lastNodeClickRef.current = { nodeId: node.id, time: now };

      if (event.detail >= 2) {
        lastNodeClickRef.current = null;
        openModuleGraph(node);
        return;
      }

      if (event.detail !== 1) return;

      clearPendingNodeClick();
      nodeClickTimeoutRef.current = setTimeout(() => {
        nodeClickTimeoutRef.current = null;
        if (lastNodeClickRef.current?.nodeId !== node.id) return;
        lastNodeClickRef.current = null;
        setPinnedId((prev) => (prev === node.id ? null : node.id));
        if (node.data.nodeType === 'Application') {
          openApplicationDetails(node.id, node.data.label ?? node.id);
        }
      }, 350);
    },
    [openApplicationDetails, clearPendingNodeClick, openModuleGraph]
  );

  const handlePaneClick = useCallback(() => {
    clearPendingNodeClick();
    lastNodeClickRef.current = null;
    setPinnedId(null);
  }, [clearPendingNodeClick]);

  const handleNodeDoubleClick = useCallback(
    (_: ReactMouseEvent, node: AppNode) => {
      lastNodeClickRef.current = null;
      openModuleGraph(node);
    },
    [openModuleGraph]
  );

  const handleNodeMouseEnter = useCallback(
    (_: ReactMouseEvent, node: AppNode) => setHoveredId(node.id),
    []
  );
  const handleNodeMouseLeave = useCallback(() => setHoveredId(null), []);

  const handleNodeDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, _node: AppNode) => {
      suppressClickAfterDragRef.current = true;
      window.setTimeout(() => {
        suppressClickAfterDragRef.current = false;
      }, 100);
      setNodes((prev) => {
        const dragged = prev.find((n) => n.id === _node.id);
        if (!dragged) return prev;
        const snapped = snapDraggedNodeForStraighterEdges(dragged.id, prev, edges, {
          nodeWidth: NODE_WIDTH,
          nodeHeight: NODE_HEIGHT,
        });
        if (!snapped) return prev;
        return prev.map((n) => (n.id === dragged.id ? { ...n, position: snapped } : n));
      });
    },
    [edges, setNodes]
  );

  function onNodeCreatedHandler(created: ApplicationResponse) {
    if (isSandbox) {
      mutateActiveSandbox((doc) => {
        if (doc.nodes.some((n) => n.id === created.id)) return doc;
        const position = {
          x: 80 + Math.random() * 160,
          y: 80 + Math.random() * 160,
        };
        const node = {
          ...buildAppNode(
            {
              id: created.id,
              label: created.name,
              type: 'Application',
              properties: created.nodeAttributes ?? {},
            },
            { appFillKey, appBorderKey, colors: legendColors }
          ),
          position,
        };
        return {
          ...doc,
          nodes: [...doc.nodes, node],
          graphNodes: [
            ...doc.graphNodes,
            {
              id: created.id,
              label: created.name,
              type: 'Application',
              description: created.description ?? null,
              properties: created.nodeAttributes ?? {},
            },
          ],
        };
      });
      return;
    }
    handleNodeCreated(created);
  }

  function onEdgeCreatedHandler(created: GraphEdgeCreateResponse): string | null {
    if (isSandbox) {
      const doc = sandboxes.activeDoc;
      if (!doc) return 'No active sandbox.';
      if (doc.edges.some((e) => e.id === created.id)) return null;
      const hasSource = doc.nodes.some((n) => n.id === created.sourceId);
      const hasTarget = doc.nodes.some((n) => n.id === created.targetId);
      if (!hasSource || !hasTarget) {
        return 'Edge created but source/target missing from the displayed graph.';
      }
      const typeById = new Map(doc.nodes.map((n) => [n.id, n.data.nodeType]));
      const createdEdge: GraphEdgeDto = {
        id: created.id,
        sourceId: created.sourceId,
        targetId: created.targetId,
        type: created.type,
        data: null,
        properties: {},
      };
      const built = buildAppEdge(
        createdEdge,
        typeById,
        colorPropertyKey,
        labelPropertyKey,
        legendColors,
        hideEdgeLabels
      );
      // No default visible label (do not show DEPENDS_ON).
      const blank: OrientedEdgeType = {
        ...built,
        label: '',
        data: { ...built.data!, dataLabel: '', displayLabel: '' },
      };
      mutateActiveSandbox((d) => ({
        ...d,
        graphEdges: [...d.graphEdges, createdEdge],
        edges: [...d.edges, blank],
        edgeLabelOverrides: { ...d.edgeLabelOverrides, [created.id]: '' },
      }));
      return null;
    }
    const msg = handleEdgeCreated(created);
    if (msg) return msg;
    return null;
  }

  function handleNodeCreated(created: ApplicationResponse) {
    setNodes((prev) => {
      if (prev.some((n) => n.id === created.id)) return prev;

      let position = { x: Math.random() * 200, y: Math.random() * 200 };
      const instance = rfRef.current;
      const el = containerRef.current;
      if (instance && el) {
        const rect = el.getBoundingClientRect();
        const center = instance.screenToFlowPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
        position = {
          x: center.x + (Math.random() * 24 - 12),
          y: center.y + (Math.random() * 24 - 12),
        };
      }

      return [
        ...prev,
        {
          ...buildAppNode(
            {
              id: created.id,
              label: created.name,
              type: 'Application',
              properties: created.nodeAttributes ?? {},
            },
            { appFillKey, appBorderKey, colors: legendColors }
          ),
          position,
        },
      ];
    });

    setGraphNodes((prev) => {
      if (prev.some((n) => n.id === created.id)) return prev;
      return [
        ...prev,
        {
          id: created.id,
          label: created.name,
          type: 'Application',
          description: created.description ?? null,
          properties: created.nodeAttributes ?? {},
        },
      ];
    });
  }

  function handleEdgeCreated(created: GraphEdgeCreateResponse): string | null {
    if (edges.some((e) => e.id === created.id)) return null;
    const hasSource = nodes.some((n) => n.id === created.sourceId);
    const hasTarget = nodes.some((n) => n.id === created.targetId);
    if (!hasSource || !hasTarget) {
      return 'Edge created but source/target missing from the displayed graph.';
    }

    const typeById = new Map(nodes.map((n) => [n.id, n.data.nodeType]));
    const createdEdge: GraphEdgeDto = {
      id: created.id,
      sourceId: created.sourceId,
      targetId: created.targetId,
      type: created.type,
      data: null,
      properties: {},
    };
    setGraphEdges((prev) => (prev.some((e) => e.id === created.id) ? prev : [...prev, createdEdge]));
    setEdges((prev) => {
      if (prev.some((e) => e.id === created.id)) return prev;
      return [
        ...prev,
        buildAppEdge(
          createdEdge,
          typeById,
          colorPropertyKey,
          labelPropertyKey,
          legendColors,
          hideEdgeLabels
        ),
      ];
    });
    return null;
  }

  /** Remove application node + incident edges from React Flow after delete */
  function onApplicationDeletedHandler(applicationId: string) {
    handleApplicationDeleted(applicationId);
    if (isSandbox) mode.setSandboxDirty(true);
  }

  function handleApplicationDeleted(applicationId: string) {
    setNodes((prev) => prev.filter((n) => n.id !== applicationId));
    setEdges((prev) =>
      prev.filter((e) => e.source !== applicationId && e.target !== applicationId)
    );
    setGraphNodes((prev) => prev.filter((n) => n.id !== applicationId));
    setGraphEdges((prev) =>
      prev.filter((e) => e.sourceId !== applicationId && e.targetId !== applicationId)
    );
    setSelectedApplication(null);
    setIsDetailsDrawerOpen(false);
  }

  function handleApplicationUpdated(applicationId: string, patch: ApplicationUpdatePatch) {
    setGraphNodes((prev) =>
      prev.map((n) =>
        n.id === applicationId
          ? {
              ...n,
              label: patch.name,
              description: patch.description ?? n.description,
            }
          : n
      )
    );
    setNodes((prev) =>
      prev.map((n) =>
        n.id === applicationId
          ? { ...n, data: { ...n.data, label: patch.name } }
          : n
      )
    );
    setSelectedApplication((prev) =>
      prev?.id === applicationId ? { ...prev, label: patch.name } : prev
    );
    if (isSandbox) mode.setSandboxDirty(true);
  }

  const activeViewTitle = useMemo(() => {
    if (moduleGraphApp) return `Modules — ${moduleGraphApp.label}`;
    if (isViewsMode) return 'My views';
    if (isSandbox) return 'Sandbox';
    return 'Production';
  }, [moduleGraphApp, isViewsMode, isSandbox]);

  const tabDescription = useMemo(() => {
    if (moduleGraphApp) {
      return 'Module dependency tree for this application. Double-click a module to explore further.';
    }
    if (isViewsMode) {
      return 'Saved views (filters, hidden apps, layout). Select a view to apply it to the graph.';
    }
    if (status === 'loading') return 'Loading graph…';
    if (status === 'error') return message;
    return message;
  }, [moduleGraphApp, isViewsMode, status, message]);

  const showGraphDisplayToggle = graphMode === 'normal' || graphMode === 'sandbox';
  const showGraphExport =
    (graphMode === 'normal' || graphMode === 'sandbox') &&
    displayMode === 'graph' &&
    moduleGraphApp == null;

  const handleSideMenuToggle = useCallback(() => {
    setIsSideMenuOpen((open) => !open);
  }, []);

  const handleExportGraph = useCallback(
    async (format: GraphImageFormat) => {
      const el = containerRef.current;
      if (!el || status !== 'ready') return;
      setIsExportingGraph(true);
      try {
        await exportGraphImage({
          element: el,
          format,
          fileName: buildGraphExportFileName(isSandbox ? 'sandbox' : 'production', format),
        });
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'Unknown error';
        setMessage(`Could not export diagram: ${detail}`);
      } finally {
        setIsExportingGraph(false);
      }
    },
    [isSandbox, status]
  );

  useEffect(() => {
    if (isViewsMode || displayMode !== 'graph') return;
    const timer = window.setTimeout(() => {
      fitGraphView(rfRef.current, { duration: 220 });
    }, 240);
    return () => window.clearTimeout(timer);
  }, [isSideMenuOpen, isViewsMode, displayMode]);

  useEffect(() => {
    if (isViewsMode || displayMode !== 'graph') return;
    const el = containerRef.current;
    if (!el) return;

    let timeout = 0;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        fitGraphView(rfRef.current, { duration: 150 });
      }, 120);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      window.clearTimeout(timeout);
    };
  }, [isViewsMode, displayMode, status]);

  const noopClose = useCallback(() => {}, []);

  const toolDetail = useMemo(() => {
    if (graphMode !== 'normal' && graphMode !== 'sandbox') return null;

    const isExplorer = graphMode === 'normal';

    switch (activeSideMenuTool) {
      case 'changes':
        if (!isExplorer) return null;
        return (
          <PendingChangesPanel
            variant="embedded"
            applications={applications}
            onPendingCountChange={setPendingChangeCount}
          />
        );
      case 'search':
        if (!isSandbox) return null;
        return <ApplicationSearchBar variant="menu" />;
      case 'filters':
        return (
          <FilterDrawer
            key={`filters-${graphMode}`}
            variant="embedded"
            isOpen
            onClose={noopClose}
            applications={applications}
            nodeFilters={nodeFilters}
            initialApplicationIds={applicationIds}
            initialNodeAttributes={nodeAttributes}
            initialNodeRefs={nodeRefs}
            initialEdgeAttributes={edgeAttributes}
            onApply={({
              applicationIds: appIds,
              nodeAttributes: attrs,
              nodeRefs: refs,
              edgeAttributes: edgeAttrs,
            }) => {
              if (isSandbox) {
                mode.setSandboxDirty(false);
                setPendingSandboxFilterHint(true);
              }
              filters.setApplicationIds(appIds);
              filters.setNodeAttributes(attrs);
              filters.setNodeRefs(refs);
              filters.setEdgeAttributes(edgeAttrs ?? {});
            }}
            showPinView={isExplorer}
            pinViewDisabled={status !== 'ready'}
            onPinView={() => setIsSaveSnapshotOpen(true)}
          />
        );
      case 'actions':
        return (
          <WorkspaceDrawer
            key={`workspace-${graphMode}`}
            variant="embedded"
            isOpen
            onClose={noopClose}
            sandboxMode={isSandbox}
            extraApplications={graphAppsForDrawer}
            onNodeCreated={onNodeCreatedHandler}
            onEdgeCreated={onEdgeCreatedHandler}
            onAddIcon={(iconKey) => {
              const id = sandboxes.activeId;
              if (!id) return;
              sandboxes.addIcon(id, iconKey, 120 + Math.random() * 80, 120 + Math.random() * 80);
            }}
            onNewSandbox={() => {
              if (sandboxes.openDocs.length >= MAX_OPEN_SANDBOXES) {
                setMessage(`At most ${MAX_OPEN_SANDBOXES} sandboxes can be open.`);
                return;
              }
              const id = sandboxes.openNew(sandboxSeed());
              if (!id) setMessage(`At most ${MAX_OPEN_SANDBOXES} sandboxes can be open.`);
            }}
            openSandboxCount={sandboxes.openDocs.length}
            savedSandboxes={sandboxes.saved}
            onLoadSandbox={(id) => {
              const result = sandboxes.loadSaved(id);
              if (result === 'full') {
                setMessage(`At most ${MAX_OPEN_SANDBOXES} sandboxes can be open.`);
              }
            }}
            onDeleteSavedSandbox={sandboxes.deleteSaved}
            layoutMode={sandboxes.layout}
            onLayoutModeChange={sandboxes.setLayout}
          />
        );
      default:
        return null;
    }
  }, [
    graphMode,
    activeSideMenuTool,
    applications,
    nodeFilters,
    applicationIds,
    nodeAttributes,
    nodeRefs,
    edgeAttributes,
    isSandbox,
    mode,
    filters,
    graphAppsForDrawer,
    onNodeCreatedHandler,
    onEdgeCreatedHandler,
    filtersActive,
    noopClose,
    sandboxes,
    sandboxSeed,
    status,
  ]);

  return (
    <div className="graph-canvas-wrap">
      <div
        className={`map-graph-panel${isSideMenuOpen ? ' is-menu-open' : ''}${
          isViewsMode ? ' is-views-mode' : isSandbox ? ' is-sandbox-mode' : ''
        }`}
      >
        <div className="map-graph-main">
          <header className="graph-view-header">
            <div className="graph-view-header-text">
              <h2 className="graph-view-header-title">{activeViewTitle}</h2>
              {tabDescription ? (
                <p
                  className={`graph-view-header-description${status === 'error' && !isViewsMode ? ' is-error' : ''}`}
                  role={status === 'error' && !isViewsMode ? 'alert' : 'status'}
                >
                  {tabDescription}
                </p>
              ) : null}
            </div>
            <div className="graph-view-header-actions">
              {showGraphExport ? (
                <GraphExportMenu
                  disabled={status !== 'ready'}
                  busy={isExportingGraph}
                  onExport={handleExportGraph}
                />
              ) : null}
              {showGraphDisplayToggle ? (
                <GraphDisplayToggle displayMode={displayMode} onChange={setDisplayMode} />
              ) : null}
              <SelfServiceBurger isOpen={isSideMenuOpen} onToggle={handleSideMenuToggle} />
            </div>
          </header>

        <div className="map-graph-body">
          <div className="graph-stage">
            {isViewsMode ? (
              <GraphViewsPanel onApply={applySavedView} />
            ) : moduleGraphApp ? (
            <div className="graph-module-drilldown" role="tabpanel" aria-label="Application module graph">
              <div className="module-map-toolbar">
                <button
                  type="button"
                  className="module-map-back"
                  onClick={() => setModuleGraphApp(null)}
                >
                  ← Back to graph
                </button>
                <span className="module-map-title">{moduleGraphApp.label}</span>
              </div>
              <ApplicationModuleGraph applicationId={moduleGraphApp.id} />
            </div>
            ) : displayMode === 'graph' && isSandbox ? (
            <div
              id="graph-canvas-pane"
              className="graph-canvas is-sandbox sandbox-stage"
              role="tabpanel"
              aria-labelledby="graph-mode-tab-sandbox"
              aria-label="Sandbox boards"
            >
              <div
                className={sandboxLayoutClass(
                  sandboxes.layout,
                  sandboxes.openDocs.length
                )}
              >
                {sandboxes.openDocs.map((doc) => (
                  <SandboxPane
                    key={doc.id}
                    doc={doc}
                    active={doc.id === sandboxes.activeId}
                    onActivate={() => sandboxes.setActiveId(doc.id)}
                    onNodesChange={() => undefined}
                    onEdgesChange={() => undefined}
                    onDocNodes={(nextNodes) => {
                      sandboxes.patchDoc(doc.id, {
                        nodes: nextNodes as AppNode[],
                        dirty: true,
                      });
                    }}
                    onDocEdges={(nextEdges) => {
                      sandboxes.patchDoc(doc.id, {
                        edges: nextEdges as OrientedEdgeType[],
                        dirty: true,
                      });
                    }}
                    onSave={() => {
                      const name =
                        doc.name.trim() ||
                        window.prompt('Sandbox name', doc.name) ||
                        doc.name;
                      sandboxes.saveDoc(doc.id, name);
                      setMessage(`Sandbox "${name}" saved.`);
                    }}
                    onClose={() => sandboxes.closeDoc(doc.id)}
                    onNodeDisplayLabel={(nodeId, label) => {
                      sandboxes.patchDoc(doc.id, (d) => ({
                        ...d,
                        dirty: true,
                        nodeLabelOverrides: { ...d.nodeLabelOverrides, [nodeId]: label },
                      }));
                    }}
                    onEdgeDisplayLabel={(edgeId, label) => {
                      sandboxes.patchDoc(doc.id, (d) => ({
                        ...d,
                        dirty: true,
                        edgeLabelOverrides: { ...d.edgeLabelOverrides, [edgeId]: label },
                      }));
                    }}
                    onIconMove={(iconId, x, y) => {
                      sandboxes.patchDoc(doc.id, (d) => ({
                        ...d,
                        dirty: true,
                        icons: d.icons.map((i) =>
                          i.id === iconId ? { ...i, x, y } : i
                        ),
                      }));
                    }}
                    onIconDelete={(iconId) => sandboxes.removeIcon(doc.id, iconId)}
                  />
                ))}
              </div>
              <div className="sandbox-shared-legend">
                <GraphLegend
                  nodeTypes={['Application']}
                  simpleMode={simpleMode}
                  colorPropertyKey={colorPropertyKey}
                  colorPropertyOptions={legendColorPropertyOptions}
                  onColorPropertyChange={handleColorPropertyChange}
                  colorValues={legendColorValues}
                  labelPropertyKey={labelPropertyKey}
                  labelPropertyOptions={legendLabelPropertyOptions}
                  onLabelPropertyChange={handleLabelPropertyChange}
                  labelValues={legendLabelValues}
                  labelStrokeColors={legendLabelStrokeColors}
                  appFillKey={appFillKey}
                  appFillOptions={legendAppPropertyOptions}
                  onAppFillChange={handleAppFillChange}
                  fillValues={legendFillValues}
                  appBorderKey={appBorderKey}
                  appBorderOptions={legendAppPropertyOptions}
                  onAppBorderChange={handleAppBorderChange}
                  borderValues={legendBorderValues}
                  legendColors={legendColors}
                  onValueColorChange={handleValueColorChange}
                  hideEdgeLabels={hideEdgeLabels}
                  legendSetups={legendSetups}
                  onSaveLegendSetup={saveLegendSetup}
                  onApplyLegendSetup={applyLegendSetup}
                  onDeleteLegendSetup={deleteLegendSetup}
                  showIndirectFlow={false}
                  sandboxIcons={sandboxes.activeDoc?.icons ?? []}
                  onSandboxIconLabelChange={(iconId, label) => {
                    const id = sandboxes.activeId;
                    if (!id) return;
                    sandboxes.updateIconLabel(id, iconId, label);
                  }}
                />
              </div>
            </div>
            ) : displayMode === 'graph' ? (
            <div
              ref={containerRef}
              id="graph-canvas-pane"
              className="graph-canvas"
              role="tabpanel"
              aria-labelledby="graph-mode-tab-normal"
              aria-label="Application dependency graph"
            >
              <ReactFlow<AppNode, Edge>
                nodes={displayNodes}
                edges={displayEdges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onInit={(instance) => {
                  rfRef.current = instance;
                }}
                onNodeClick={handleNodeClick}
                onNodeDoubleClick={handleNodeDoubleClick}
                onNodeMouseEnter={handleNodeMouseEnter}
                onNodeMouseLeave={handleNodeMouseLeave}
                onNodeDragStop={handleNodeDragStop}
                onPaneClick={handlePaneClick}
                nodesDraggable
                nodeDragThreshold={8}
                nodesConnectable={false}
                elementsSelectable
                snapToGrid
                snapGrid={[GRID, GRID]}
                minZoom={0.05}
                maxZoom={2.5}
                proOptions={{ hideAttribution: true }}
              >
                <Background color="#e2e8f0" gap={GRID} />
                <Controls showInteractive={false} />
                <Panel position="top-left">
                  <GraphLegend
                    nodeTypes={['Application']}
                    simpleMode={simpleMode}
                    colorPropertyKey={colorPropertyKey}
                    colorPropertyOptions={legendColorPropertyOptions}
                    onColorPropertyChange={handleColorPropertyChange}
                    colorValues={legendColorValues}
                    labelPropertyKey={labelPropertyKey}
                    labelPropertyOptions={legendLabelPropertyOptions}
                    onLabelPropertyChange={handleLabelPropertyChange}
                    labelValues={legendLabelValues}
                    labelStrokeColors={legendLabelStrokeColors}
                    appFillKey={appFillKey}
                    appFillOptions={legendAppPropertyOptions}
                    onAppFillChange={handleAppFillChange}
                    fillValues={legendFillValues}
                    appBorderKey={appBorderKey}
                    appBorderOptions={legendAppPropertyOptions}
                    onAppBorderChange={handleAppBorderChange}
                    borderValues={legendBorderValues}
                    legendColors={legendColors}
                    onValueColorChange={handleValueColorChange}
                    hideEdgeLabels={hideEdgeLabels}
                    legendSetups={legendSetups}
                    onSaveLegendSetup={saveLegendSetup}
                    onApplyLegendSetup={applyLegendSetup}
                    onDeleteLegendSetup={deleteLegendSetup}
                    showIndirectFlow={showIndirectFlow}
                  />
                </Panel>
                {hiddenCount > 0 ? (
                  <Panel position="top-right">
                    <HiddenAppsPicker
                      hiddenIds={hiddenIdsSnapshot}
                      options={hiddenAppOptions}
                      onShow={expandHidden}
                    />
                  </Panel>
                ) : null}
              </ReactFlow>
            </div>
            ) : (
              <div className="graph-tables-view">
                <section
                  className="graph-table-section graph-table-section--single"
                  aria-label={tableContent === 'apps' ? 'Apps' : 'Flows'}
                >
                  <div className="graph-table-section-heading">
                    <TableContentToggle value={tableContent} onChange={setTableContent} />
                  </div>
                  {tableContent === 'apps' ? (
                    <ApplicationsTablePanel
                      isOpen
                      variant="main"
                      status={status}
                      nodes={graphNodes}
                      applicationsCatalog={applications}
                      nodeFilters={nodeFilters}
                      errorMessage={status === 'error' ? message : null}
                      onRowClick={openApplicationDetails}
                    />
                  ) : (
                    <FeedsTablePanel
                      isOpen
                      variant="main"
                      status={status}
                      edges={graphEdges}
                      nodes={graphNodes}
                      errorMessage={status === 'error' ? message : null}
                      onRowClick={openApplicationDetails}
                    />
                  )}
                </section>
              </div>
            )}

            <SaveSnapshotDialog
              isOpen={isSaveSnapshotOpen}
              onClose={() => setIsSaveSnapshotOpen(false)}
              onSave={handleSaveSnapshot}
            />

            <button
              type="button"
              className={`graph-panel-overlay graph-panel-overlay--details${isDetailsDrawerOpen ? ' is-visible' : ''}`}
              aria-label="Close details panel"
              onClick={() => setIsDetailsDrawerOpen(false)}
            />
            <ApplicationDetailsDrawer
              isOpen={isDetailsDrawerOpen}
              application={selectedApplication}
              onClose={() => setIsDetailsDrawerOpen(false)}
              sandboxMode={isSandbox}
              resolveSandboxApplication={resolveSandboxApplication}
              onApplicationUpdated={handleApplicationUpdated}
              onOpenModuleGraph={(applicationId) => {
                const label =
                  selectedApplication?.id === applicationId
                    ? selectedApplication.label
                    : applicationId;
                openModuleGraphById(applicationId, label);
              }}
              onApplicationDeleted={onApplicationDeletedHandler}
            />
          </div>
        </div>
        </div>

        <SelfServiceSideMenu
          isOpen={isSideMenuOpen}
          onToggle={handleSideMenuToggle}
          graphMode={graphMode}
          sandboxDirty={sandboxDirty}
          filtersActive={filtersActive}
          activeTool={activeSideMenuTool}
          onActiveToolChange={setActiveSideMenuTool}
          pendingChangeCount={pendingChangeCount}
          onModeChange={(nextMode) => {
            setDisplayMode('graph');
            setModuleGraphApp(null);
            setActiveSideMenuTool((current) => {
              if (nextMode === 'sandbox' && current === 'changes') return 'search';
              if (nextMode === 'normal' && current === 'search') return 'changes';
              return current;
            });
            if (nextMode === 'sandbox') mode.switchToSandboxMode();
            else if (nextMode === 'views') mode.switchToViewsMode();
            else mode.switchToNormalMode();
          }}
          toolDetail={toolDetail}
        />
      </div>
    </div>
  );
}

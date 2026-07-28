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
import { WorkspaceDrawer } from './WorkspaceDrawer';
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
import { fitGraphView } from './fitGraphView';
import { GraphViewsPanel } from './GraphViewsPanel';
import { SaveSnapshotDialog } from './SaveSnapshotDialog';
import { ApplicationSearchBar } from './ApplicationSearchBar';
import {
  layoutCollapsedAppGraph,
  type NodePositionsMap,
} from './layoutCollapsedAppGraph';

type PendingViewRestore = {
  hiddenApplicationIds: string[];
  nodePositions: NodePositionsMap;
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
  /** Local-only collapse set; tables keep using the full graph DTOs. */
  const hiddenNodeIdsRef = useRef<Set<string>>(new Set());
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

  const mode = useGraphMode({
    setMessage,
    setIsDrawerOpen: setWorkspacePanelOpen,
    setIsFilterDrawerOpen: setFilterPanelOpen,
    setIsDetailsDrawerOpen,
    reloadGraph,
  });
  const { graphMode, sandboxDirty, graphModeRef, isSandbox, isViewsMode } = mode;

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
    filtersActive,
    applyGraphFilters,
    currentGraphFilters,
  } = filters;

  const data = useGraphData({
    applicationIds,
    nodeAttributes,
    nodeRefs,
    filtersActive,
    graphReloadNonce,
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
    colorPropertyKey,
    handleColorPropertyChange,
    legendColorPropertyOptions,
    legendColorValues,
  } = data;

  const graphAppsForDrawer = useMemo(
    () =>
      graphNodes
        .filter((n) => n.type === 'Application')
        .map((n) => applicationResponseFromGraphNode(n)),
    [graphNodes]
  );

  const resolveSandboxApplication = useCallback(
    (id: string) => {
      const node = graphNodes.find((n) => n.id === id);
      if (!node) return null;
      return applicationResponseFromGraphNode(node);
    },
    [graphNodes]
  );

  useEffect(() => {
    const state = location.state as MapLocationState | null;
    if (!state?.applySnapshot && !state?.graphMode) return;

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

  const relayoutCollapsed = useCallback(
    async (nextHidden: ReadonlySet<string>, nodePositions?: NodePositionsMap) => {
      if (status !== 'ready' || graphNodes.length === 0) return;
      const gen = ++collapseGenerationRef.current;
      const rect = containerRef.current?.getBoundingClientRect();
      const aspectRatio = rect && rect.height > 0 ? rect.width / rect.height : 16 / 9;
      const laid = await layoutCollapsedAppGraph({
        graphNodes,
        graphEdges,
        hiddenNodeIds: nextHidden,
        colorPropertyKey,
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
      if (nodePositions && Object.keys(nodePositions).length > 0) {
        window.setTimeout(() => fitGraphView(rfRef.current, { duration: 200 }), 40);
      }
    },
    [status, graphNodes, graphEdges, colorPropertyKey, setNodes, setEdges]
  );

  const hideNode = useCallback(
    (nodeId: string) => {
      if (hiddenNodeIdsRef.current.has(nodeId)) return;
      const next = new Set(hiddenNodeIdsRef.current);
      next.add(nodeId);
      hiddenNodeIdsRef.current = next;
      setHoveredId((prev) => (prev === nodeId ? null : prev));
      setPinnedId((prev) => (prev === nodeId ? null : prev));
      void relayoutCollapsed(next);
    },
    [relayoutCollapsed]
  );

  const expandHidden = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const next = new Set(hiddenNodeIdsRef.current);
      let changed = false;
      for (const id of ids) {
        if (next.delete(id)) changed = true;
      }
      if (!changed) return;
      hiddenNodeIdsRef.current = next;
      void relayoutCollapsed(next);
    },
    [relayoutCollapsed]
  );

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
      return;
    }
    const hadHidden = hiddenNodeIdsRef.current.size > 0;
    hiddenNodeIdsRef.current = new Set();
    if (hadHidden) {
      void relayoutCollapsed(new Set());
    }
  }, [graphMode, graphReloadNonce, relayoutCollapsed]);

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
    void relayoutCollapsed(
      nextHidden,
      Object.keys(nextPositions).length > 0 ? nextPositions : undefined
    );
  }, [status, graphNodes, graphEdges, relayoutCollapsed]);

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
    handleNodeCreated(created);
    if (isSandbox) mode.setSandboxDirty(true);
  }

  function onEdgeCreatedHandler(created: GraphEdgeCreateResponse): string | null {
    const msg = handleEdgeCreated(created);
    if (msg) return msg;
    if (isSandbox) mode.setSandboxDirty(true);
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
          ...buildAppNode({ id: created.id, label: created.name, type: 'Application' }),
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
      return [...prev, buildAppEdge(createdEdge, typeById, colorPropertyKey)];
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

  const handleSideMenuToggle = useCallback(() => {
    setIsSideMenuOpen((open) => !open);
  }, []);

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
      case 'search':
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
            onApply={({ applicationIds: appIds, nodeAttributes: attrs, nodeRefs: refs }) => {
              if (isSandbox) {
                mode.setSandboxDirty(false);
                setPendingSandboxFilterHint(true);
              }
              filters.setApplicationIds(appIds);
              filters.setNodeAttributes(attrs);
              filters.setNodeRefs(refs);
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
    isSandbox,
    mode,
    filters,
    graphAppsForDrawer,
    onNodeCreatedHandler,
    onEdgeCreatedHandler,
    filtersActive,
    noopClose,
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
            ) : displayMode === 'graph' ? (
            <div
              ref={containerRef}
              id="graph-canvas-pane"
              className={`graph-canvas${isSandbox ? ' is-sandbox' : ''}`}
              role="tabpanel"
              aria-labelledby={
                graphMode === 'sandbox' ? 'graph-mode-tab-sandbox' : 'graph-mode-tab-normal'
              }
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
                    colorPropertyKey={colorPropertyKey}
                    colorPropertyOptions={legendColorPropertyOptions}
                    onColorPropertyChange={handleColorPropertyChange}
                    colorValues={legendColorValues}
                    showIndirectFlow
                  />
                </Panel>
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
          onModeChange={(nextMode) => {
            setDisplayMode('graph');
            setModuleGraphApp(null);
            setActiveSideMenuTool('filters');
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

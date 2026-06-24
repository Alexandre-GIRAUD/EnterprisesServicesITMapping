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
  BusinessUnitListItem,
  GraphEdgeCreateResponse,
  GraphEdgeDto,
  RegionSummary,
} from '@/types/api';
import { fetchApplications } from '../api/applicationsApi';
import { fetchBusinessUnits } from '../api/businessUnitsApi';
import { fetchRegions } from '../api/regionsApi';
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
import { fitGraphView } from './fitGraphView';
import { GraphViewsPanel } from './GraphViewsPanel';
import { SaveSnapshotDialog } from './SaveSnapshotDialog';
import { ApplicationSearchBar } from './ApplicationSearchBar';

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
  const [businessUnits, setBusinessUnits] = useState<BusinessUnitListItem[]>([]);
  const [regions, setRegions] = useState<RegionSummary[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  // Hover takes priority; if no hover, the pinned node keeps the highlight.
  const focusedId = hoveredId ?? pinnedId;
  const [graphReloadNonce, setGraphReloadNonce] = useState(0);
  const [pendingSandboxFilterHint, setPendingSandboxFilterHint] = useState(false);
  const [isSaveSnapshotOpen, setIsSaveSnapshotOpen] = useState(false);
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [displayMode, setDisplayMode] = useState<GraphDisplayMode>('graph');
  const [moduleGraphApp, setModuleGraphApp] = useState<{ id: string; label: string } | null>(null);
  const [activeSideMenuTool, setActiveSideMenuTool] = useState<SideMenuTool>('filters');

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
    year,
    applicationIds,
    businessUnitIds,
    regionCodes,
    filtersActive,
    applyGraphFilters,
    currentGraphFilters,
  } = filters;

  const data = useGraphData({
    year,
    applicationIds,
    businessUnitIds,
    regionCodes,
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
      applyGraphFilters(state.applySnapshot);
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
      setMessage('Impact Sandbox — customize your graph, no changes saved.');
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

  async function handleSaveSnapshot(name: string) {
    await createGraphSnapshot(name, currentGraphFilters);
    refreshSnapshots();
    setMessage(`View "${name}" saved.`);
  }

  const nodeTypes = useMemo<NodeTypes>(() => ({ app: AppGraphNode }), []);
  const edgeTypes = useMemo<EdgeTypes>(() => ({ oriented: OrientedEdge }), []);

  // Focus neighborhood for hover/selection dimming (null = nothing focused).
  const focus = useMemo(
    () => (focusedId ? computeFocus(edges, focusedId) : null),
    [edges, focusedId]
  );

  const displayNodes = useMemo(() => {
    if (!focus) return nodes;
    return nodes.map((n) => ({
      ...n,
      className: `graph-node ${focus.nodeIds.has(n.id) ? 'is-focus' : 'is-faded'}`,
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

  const refreshBusinessUnits = useCallback(async () => {
    try {
      const rows = await fetchBusinessUnits();
      setBusinessUnits(rows);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshRegions = useCallback(async () => {
    try {
      const rows = await fetchRegions();
      setRegions(rows);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refreshApplications();
    void refreshBusinessUnits();
    void refreshRegions();
  }, [refreshApplications, refreshBusinessUnits, refreshRegions]);

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
          year: created.year ?? undefined,
          description: created.description ?? null,
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
              year: patch.year ?? undefined,
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
    if (isSandbox) return 'Impact Sandbox';
    return 'Information System Explorer';
  }, [moduleGraphApp, isViewsMode, isSandbox]);

  const tabDescription = useMemo(() => {
    if (moduleGraphApp) {
      return 'Module dependency tree for this application. Double-click a module to explore further.';
    }
    if (isViewsMode) {
      return 'Pinned filter sets. Select a view to apply it to the graph.';
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
            businessUnits={businessUnits}
            regions={regions}
            initialYear={year}
            initialApplicationIds={applicationIds}
            initialBusinessUnitIds={businessUnitIds}
            initialRegionCodes={regionCodes}
            onApply={({ year: y, applicationIds: appIds, businessUnitIds: buIds, regionCodes: codes }) => {
              if (isSandbox) {
                mode.setSandboxDirty(false);
                setPendingSandboxFilterHint(true);
              }
              filters.setYear(y);
              filters.setApplicationIds(appIds);
              filters.setBusinessUnitIds(buIds);
              filters.setRegionCodes(codes);
            }}
            showPinView={isExplorer}
            pinViewDisabled={!filtersActive}
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
            onBusinessUnitsChanged={refreshBusinessUnits}
          />
        );
      default:
        return null;
    }
  }, [
    graphMode,
    activeSideMenuTool,
    applications,
    businessUnits,
    regions,
    year,
    applicationIds,
    businessUnitIds,
    regionCodes,
    isSandbox,
    mode,
    filters,
    graphAppsForDrawer,
    onNodeCreatedHandler,
    onEdgeCreatedHandler,
    refreshBusinessUnits,
    filtersActive,
    noopClose,
  ]);

  return (
    <div className="graph-canvas-wrap">
      <div className={`map-graph-panel${isSideMenuOpen ? ' is-menu-open' : ''}`}>
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
              <GraphViewsPanel
                onApply={(snapshotFilters) => {
                  applyGraphFilters(snapshotFilters);
                  reloadGraph();
                }}
              />
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
                  />
                </Panel>
              </ReactFlow>
            </div>
            ) : (
              <ApplicationsTablePanel
                isOpen
                variant="main"
                status={status}
                nodes={graphNodes}
                applicationsCatalog={applications}
                errorMessage={status === 'error' ? message : null}
                onRowClick={openApplicationDetails}
              />
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

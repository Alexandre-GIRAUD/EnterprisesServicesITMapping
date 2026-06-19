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
import { applicationResponseFromGraphNode } from '../utils/sandboxGraph';
import type { ApplicationUpdatePatch } from './ApplicationDetailsDrawer';
import { ApplicationSearchBar } from './ApplicationSearchBar';
import { GraphModeTabs } from './GraphModeTabs';
import { GraphViewsPanel } from './GraphViewsPanel';
import { SaveSnapshotDialog } from './SaveSnapshotDialog';

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

  const [message, setMessage] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isTableOpen, setIsTableOpen] = useState(false);
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

  const reloadGraph = useCallback(() => setGraphReloadNonce((n) => n + 1), []);

  const mode = useGraphMode({
    setMessage,
    setIsDrawerOpen,
    setIsFilterDrawerOpen,
    setIsDetailsDrawerOpen,
    reloadGraph,
  });
  const { graphMode, sandboxDirty, graphModeRef, isSandbox, isViewsMode } = mode;

  const filters = useGraphFilters({
    graphModeRef,
    setGraphMode: mode.setGraphMode,
    setSandboxDirty: mode.setSandboxDirty,
    setIsDrawerOpen,
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
        setIsDrawerOpen(false);
        setIsFilterDrawerOpen(false);
        setIsDetailsDrawerOpen(false);
        reloadGraph();
      }
    } else if (state.graphMode === 'sandbox') {
      mode.setGraphMode('sandbox');
      mode.setSandboxDirty(false);
      setMessage('Impact Sandbox — customize your graph, no changes saved.');
      setIsDrawerOpen(true);
    } else if (state.graphMode === 'views') {
      mode.setGraphMode('views');
      mode.setSandboxDirty(false);
      setIsDrawerOpen(false);
      setIsFilterDrawerOpen(false);
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
    setIsDrawerOpen(false);
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

  const handleNodeClick = useCallback(
    (_: ReactMouseEvent, node: AppNode) => {
      // Toggle pin: clicking the same node again releases the highlight lock.
      setPinnedId((prev) => (prev === node.id ? null : node.id));
      if (node.data.nodeType === 'Application') {
        openApplicationDetails(node.id, node.data.label ?? node.id);
      }
    },
    [openApplicationDetails]
  );

  const handlePaneClick = useCallback(() => setPinnedId(null), []);

  const handleNodeDoubleClick = useCallback(
    (_: ReactMouseEvent, node: AppNode) => {
      if (isSandbox) return;
      if (node.data.nodeType === 'Application') {
        navigate(`/map/apps/${encodeURIComponent(node.id)}`);
      }
    },
    [navigate, isSandbox]
  );

  const handleNodeMouseEnter = useCallback(
    (_: ReactMouseEvent, node: AppNode) => setHoveredId(node.id),
    []
  );
  const handleNodeMouseLeave = useCallback(() => setHoveredId(null), []);

  const handleNodeDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, _node: AppNode) => {
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

  const tabDescription = useMemo(() => {
    if (isViewsMode) {
      return 'Pinned filter sets. Select a view to apply it to the graph.';
    }
    if (status === 'loading') return 'Loading graph…';
    if (status === 'error') return message;
    return message;
  }, [isViewsMode, status, message]);

  return (
    <div className="graph-canvas-wrap">
      <div className="map-graph-panel">
        <div className="graph-mode-tabs-bar">
          <GraphModeTabs
            mode={graphMode}
            sandboxDirty={sandboxDirty}
            onModeChange={(nextMode) => {
              if (nextMode === 'sandbox') mode.switchToSandboxMode();
              else if (nextMode === 'views') mode.switchToViewsMode();
              else mode.switchToNormalMode();
            }}
          />
          {tabDescription ? (
            <p
              className={`graph-mode-tabs-description${status === 'error' && !isViewsMode ? ' is-error' : ''}`}
              role={status === 'error' && !isViewsMode ? 'alert' : 'status'}
            >
              {tabDescription}
            </p>
          ) : null}
        </div>
        <div className={`map-graph-body${isDrawerOpen ? ' is-drawer-open' : ''}`}>
          <div className="graph-stage">
            {isViewsMode ? (
              <GraphViewsPanel
                onApply={(snapshotFilters) => {
                  applyGraphFilters(snapshotFilters);
                  reloadGraph();
                }}
              />
            ) : (
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
              <div className="graph-canvas-search">
                <ApplicationSearchBar variant="canvas" />
              </div>

              <button
                type="button"
                className="graph-filter-toggle"
                onClick={() => setIsFilterDrawerOpen((open) => !open)}
                aria-expanded={isFilterDrawerOpen}
                aria-controls="graph-filter-drawer"
              >
                <span className="graph-drawer-toggle-label">Filters</span>
                <span className="graph-drawer-toggle-icon" aria-hidden="true">
                  {filtersActive ? 'On' : 'Off'}
                </span>
              </button>

              {filtersActive && !isSandbox ? (
                <button
                  type="button"
                  className="graph-save-snapshot-btn"
                  onClick={() => setIsSaveSnapshotOpen(true)}
                >
                  Pin view
                </button>
              ) : null}

              <SaveSnapshotDialog
                isOpen={isSaveSnapshotOpen}
                onClose={() => setIsSaveSnapshotOpen(false)}
                onSave={handleSaveSnapshot}
              />

              <button
                type="button"
                className={`graph-panel-overlay graph-panel-overlay--filter${isFilterDrawerOpen ? ' is-visible' : ''}`}
                aria-label="Close filters"
                onClick={() => setIsFilterDrawerOpen(false)}
              />
              <FilterDrawer
                isOpen={isFilterDrawerOpen}
                onClose={() => setIsFilterDrawerOpen(false)}
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
              />

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
              <button
                type="button"
                className="graph-edit-toggle"
                onClick={() => setIsDrawerOpen((open) => !open)}
                aria-expanded={isDrawerOpen}
                aria-controls="graph-actions-drawer"
                aria-label={
                  isDrawerOpen
                    ? isSandbox
                      ? 'Close toolkit panel'
                      : 'Close corrections panel'
                    : isSandbox
                      ? 'Open toolkit panel'
                      : 'Open corrections panel'
                }
              >
                <span className="graph-drawer-toggle-label">
                  {isSandbox ? 'Toolkit' : 'Corrections'}
                </span>
                <span className="graph-drawer-toggle-icon" aria-hidden="true">
                  {isDrawerOpen ? 'Close' : 'Open'}
                </span>
              </button>
            </div>
            )}

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
                navigate(`/map/apps/${encodeURIComponent(applicationId)}`);
              }}
              onApplicationDeleted={onApplicationDeletedHandler}
            />
          </div>

          {!isViewsMode ? (
            <>
          <button
            type="button"
            className={`graph-panel-overlay graph-panel-overlay--edit${isDrawerOpen ? ' is-visible' : ''}`}
            aria-label="Close drawer"
            onClick={() => setIsDrawerOpen(false)}
          />
          <WorkspaceDrawer
            isOpen={isDrawerOpen}
            onClose={() => setIsDrawerOpen(false)}
            sandboxMode={isSandbox}
            extraApplications={graphAppsForDrawer}
            onNodeCreated={onNodeCreatedHandler}
            onEdgeCreated={onEdgeCreatedHandler}
            onBusinessUnitsChanged={refreshBusinessUnits}
          />
            </>
          ) : null}
        </div>
      </div>

      <div className="graph-table-section">
        <button
          type="button"
          className="graph-table-toggle"
          disabled={status === 'loading'}
          onClick={() => setIsTableOpen((open) => !open)}
          aria-expanded={isTableOpen}
          aria-controls="graph-applications-table-panel"
        >
          <span className="graph-table-toggle-icon" aria-hidden="true">
            ⊞
          </span>
          <span>Table</span>
          <span className="graph-table-toggle-count" aria-hidden="true">
            {graphNodes.filter((n) => n.type === 'Application').length}
          </span>
        </button>
        <ApplicationsTablePanel
          isOpen={isTableOpen}
          status={status}
          nodes={graphNodes}
          applicationsCatalog={applications}
          errorMessage={status === 'error' ? message : null}
          onRowClick={openApplicationDetails}
        />
      </div>
    </div>
  );
}

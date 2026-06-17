import {
  Background,
  Controls,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
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
  GraphNodeDto,
  GraphSnapshotFilters,
  RegionSummary,
} from '@/types/api';
import { fetchApplications } from '../api/applicationsApi';
import { fetchBusinessUnits } from '../api/businessUnitsApi';
import { fetchRegions } from '../api/regionsApi';
import { fetchGraph } from '../api/graphApi';
import { createGraphSnapshot } from '../api/graphSnapshotsApi';
import { useGraphSnapshotsRefresh } from '../context/GraphSnapshotsContext';
import type { MapLocationState } from '../utils/mapNavigation';
import { WorkspaceDrawer } from './WorkspaceDrawer';
import { FilterDrawer } from './FilterDrawer';
import { ApplicationDetailsDrawer } from './ApplicationDetailsDrawer';
import { ApplicationsTablePanel } from './ApplicationsTablePanel';
import { layoutGraph } from './graphLayout';
import { elkLayout } from './elkLayout';
import { snapDraggedNodeForStraighterEdges } from './alignNodes';
import { computeBridges } from './bridges';
import { GraphLegend } from './GraphLegend';
import {
  collectLegendColorValues,
  colorPropertyOptions,
  loadStoredColorPropertyKey,
  resolveColorPropertyKey,
  storeColorPropertyKey,
} from './edgeColorProperty';
import { AppGraphNode, type AppGraphNodeType } from './AppGraphNode';
import { OrientedEdge, type OrientedEdgeType } from './OrientedEdge';
import { buildOrientedEdge, attachRoute, restyleEdgeColorProperty } from './orientedEdgeBuilders';
import { computeFocus } from './graphFocus';
import { fitGraphView } from './fitGraphView';
import { applicationResponseFromGraphNode } from '../utils/sandboxGraph';
import type { ApplicationUpdatePatch } from './ApplicationDetailsDrawer';
import { GraphModeTabs, type GraphMode } from './GraphModeTabs';
import { SaveSnapshotDialog } from './SaveSnapshotDialog';

type SelectedApplication = {
  id: string;
  label: string;
};

type AppNode = AppGraphNodeType;

const NODE_WIDTH = 160;
const NODE_HEIGHT = 48;
const GRID = 16;

function buildAppNode(node: GraphNodeDto): AppNode {
  return {
    id: node.id,
    type: 'app',
    position: { x: 0, y: 0 },
    data: { label: node.label, nodeType: node.type },
    className: 'graph-node',
  };
}

function buildAppEdge(
  edge: GraphEdgeDto,
  typeById: Map<string, string>,
  colorPropertyKey: string
) {
  return buildOrientedEdge({
    id: edge.id,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    relationType: edge.type,
    dataLabel: edge.data,
    colorPropertyKey,
    properties: edge.properties,
    sourceNodeType: typeById.get(edge.sourceId) ?? 'Application',
    targetNodeType: typeById.get(edge.targetId) ?? 'Application',
  });
}

/**
 * Application dependency graph (React Flow), backed by GET /api/graph.
 */
export function GraphCanvas() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshSnapshots } = useGraphSnapshotsRefresh();
  const containerRef = useRef<HTMLDivElement>(null);
  const rfRef = useRef<ReactFlowInstance<AppNode, Edge> | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isTableOpen, setIsTableOpen] = useState(false);
  const [graphNodes, setGraphNodes] = useState<GraphNodeDto[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<SelectedApplication | null>(null);
  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState(false);
  const [applications, setApplications] = useState<ApplicationResponse[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnitListItem[]>([]);
  const [regions, setRegions] = useState<RegionSummary[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [applicationIds, setApplicationIds] = useState<string[]>([]);
  const [businessUnitIds, setBusinessUnitIds] = useState<string[]>([]);
  const [regionCodes, setRegionCodes] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  // Hover takes priority; if no hover, the pinned node keeps the highlight.
  const focusedId = hoveredId ?? pinnedId;
  const [layoutRevision, setLayoutRevision] = useState(0);
  const [graphEdges, setGraphEdges] = useState<GraphEdgeDto[]>([]);
  const graphEdgesRef = useRef(graphEdges);
  graphEdgesRef.current = graphEdges;
  const [colorPropertyKey, setColorPropertyKey] = useState(loadStoredColorPropertyKey);
  const [graphMode, setGraphMode] = useState<GraphMode>('normal');
  const [sandboxDirty, setSandboxDirty] = useState(false);
  const [graphReloadNonce, setGraphReloadNonce] = useState(0);
  const [pendingSandboxFilterHint, setPendingSandboxFilterHint] = useState(false);
  const [isSaveSnapshotOpen, setIsSaveSnapshotOpen] = useState(false);
  const isSandbox = graphMode === 'sandbox';
  const graphModeRef = useRef(graphMode);
  graphModeRef.current = graphMode;
  const filtersActive =
    year != null ||
    applicationIds.length > 0 ||
    businessUnitIds.length > 0 ||
    regionCodes.length > 0;
  const legendColorPropertyOptions = useMemo(
    () => colorPropertyOptions(graphEdges),
    [graphEdges]
  );
  const legendColorValues = useMemo(
    () => collectLegendColorValues(graphEdges, colorPropertyKey),
    [graphEdges, colorPropertyKey]
  );

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

  function switchToSandboxMode() {
    setGraphMode('sandbox');
    setSandboxDirty(false);
    setMessage('Sandbox mode — changes are not saved.');
    setIsDrawerOpen(true);
  }

  function switchToNormalMode() {
    if (
      sandboxDirty &&
      !window.confirm('Leave sandbox? Local changes will be lost.')
    ) {
      return;
    }
    setGraphMode('normal');
    setSandboxDirty(false);
    setIsDrawerOpen(false);
    setGraphReloadNonce((n) => n + 1);
  }

  const applyGraphFilters = useCallback((filters: GraphSnapshotFilters) => {
    if (graphModeRef.current === 'sandbox') {
      setGraphMode('normal');
      setSandboxDirty(false);
      setIsDrawerOpen(false);
    }
    setYear(filters.year);
    setApplicationIds(filters.applicationIds);
    setBusinessUnitIds(filters.businessUnitIds);
    setRegionCodes(filters.regionCodes);
  }, []);

  const currentGraphFilters = useMemo<GraphSnapshotFilters>(
    () => ({
      year,
      applicationIds,
      businessUnitIds,
      regionCodes,
    }),
    [year, applicationIds, businessUnitIds, regionCodes]
  );

  useEffect(() => {
    const state = location.state as MapLocationState | null;
    if (!state?.applySnapshot) return;
    applyGraphFilters(state.applySnapshot);
    navigate('.', { replace: true, state: {} });
  }, [location.state, applyGraphFilters, navigate]);

  async function handleSaveSnapshot(name: string) {
    await createGraphSnapshot(name, currentGraphFilters);
    refreshSnapshots();
    setMessage(`View "${name}" saved.`);
  }

  const handleColorPropertyChange = useCallback((key: string) => {
    setColorPropertyKey(key);
    storeColorPropertyKey(key);
  }, []);

  // Re-stroke edges when the user picks another color property (keep ELK routes).
  useEffect(() => {
    if (status !== 'ready') return;
    setEdges((prev) => {
      if (prev.length === 0) return prev;
      const byId = new Map(graphEdgesRef.current.map((edge) => [edge.id, edge]));
      return prev.map((edge) =>
        restyleEdgeColorProperty(edge as OrientedEdgeType, colorPropertyKey, byId.get(edge.id))
      );
    });
  }, [colorPropertyKey, status, setEdges]);

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

  // Fit the full diagram once nodes are rendered (double rAF inside fitGraphView).
  useEffect(() => {
    if (status !== 'ready' || nodes.length === 0 || layoutRevision === 0) return;
    fitGraphView(rfRef.current);
  }, [status, nodes.length, layoutRevision]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setStatus('loading');
        setMessage(null);
        const data = await fetchGraph({
          year: year ?? undefined,
          applicationIds: applicationIds.length > 0 ? applicationIds : undefined,
          businessUnitIds: businessUnitIds.length > 0 ? businessUnitIds : undefined,
          regionCodes: regionCodes.length > 0 ? regionCodes : undefined,
        });
        if (cancelled) return;

        setGraphNodes(data.nodes);
        setGraphEdges(data.edges);
        const effectiveColorKey = resolveColorPropertyKey(colorPropertyKey, data.edges);
        if (effectiveColorKey !== colorPropertyKey) {
          setColorPropertyKey(effectiveColorKey);
          storeColorPropertyKey(effectiveColorKey);
        }

        const typeById = new Map(data.nodes.map((n) => [n.id, n.type]));
        const baseNodes = data.nodes.map(buildAppNode);
        const builtEdges = data.edges.map((e) => buildAppEdge(e, typeById, effectiveColorKey));
        const rect = containerRef.current?.getBoundingClientRect();
        const aspectRatio = rect && rect.height > 0 ? rect.width / rect.height : 16 / 9;

        try {
          // Preferred: ELK layered layout with node-avoiding orthogonal routing.
          const { nodes: laidOut, routes } = await elkLayout(baseNodes, builtEdges, {
            nodeWidth: NODE_WIDTH,
            nodeHeight: NODE_HEIGHT,
            nodeSeparation: 70,
            layerSeparation: 100,
            aspectRatio,
          });
          if (cancelled) return;
          const jumps = computeBridges(routes);
          setNodes(laidOut);
          setEdges(builtEdges.map((e) => attachRoute(e, routes.get(e.id), jumps.get(e.id))));
        } catch {
          // Fallback: dagre layout + smoothstep edges if ELK fails.
          if (cancelled) return;
          setNodes(
            layoutGraph(baseNodes, builtEdges, {
              nodeWidth: NODE_WIDTH,
              nodeHeight: NODE_HEIGHT,
              nodeSeparation: 70,
              rankSeparation: 100,
              snapGrid: GRID,
              aspectRatio,
            })
          );
          setEdges(builtEdges);
        }

        if (!cancelled) setLayoutRevision((v) => v + 1);

        setStatus('ready');
        if (pendingSandboxFilterHint) {
          setMessage('Filters applied — sandbox draft reset.');
          setPendingSandboxFilterHint(false);
        } else {
          const emptyHint =
            data.nodes.length === 0
              ? filtersActive
                ? 'No applications match these filters (year / business unit / location). Change criteria or reset.'
                : 'No nodes. Start the backend with Neo4j to load demo data.'
              : graphModeRef.current === 'sandbox'
                ? 'Sandbox mode — changes are not saved.'
                : 'Tip: click an application to open its module graph.';
          setMessage(emptyHint);
        }
      } catch (e) {
        if (!cancelled) {
          setGraphNodes([]);
          setGraphEdges([]);
          setNodes([]);
          setEdges([]);
          setStatus('error');
          let msg = e instanceof Error ? e.message : 'Unable to load the graph';
          if (msg === 'Failed to fetch') {
            msg +=
              ' — backend is unreachable. In Vite dev, check VITE_API_PROXY_TARGET (e.g. 8081 with Docker) or start Spring Boot on the expected port.';
          }
          setMessage(msg);
        }
      }
    })();

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDetailsDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onEscape);

    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onEscape);
    };
  }, [
    year,
    applicationIds,
    businessUnitIds,
    regionCodes,
    filtersActive,
    graphReloadNonce,
    setNodes,
    setEdges,
  ]);

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
    if (isSandbox) setSandboxDirty(true);
  }

  function onEdgeCreatedHandler(created: GraphEdgeCreateResponse): string | null {
    const msg = handleEdgeCreated(created);
    if (msg) return msg;
    if (isSandbox) setSandboxDirty(true);
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
    if (isSandbox) setSandboxDirty(true);
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
    if (isSandbox) setSandboxDirty(true);
  }

  return (
    <div className="graph-canvas-wrap">
      {status === 'loading' && (
        <p className="graph-canvas-status" role="status">
          Loading graph…
        </p>
      )}
      {status === 'error' && message && (
        <p className="graph-canvas-error" role="alert">
          {message}
        </p>
      )}
      {status === 'ready' && message && (
        <p className="graph-canvas-hint">{message}</p>
      )}
      <div className="map-graph-panel">
        <GraphModeTabs
          mode={graphMode}
          sandboxDirty={sandboxDirty}
          onModeChange={(mode) => {
            if (mode === 'sandbox') switchToSandboxMode();
            else switchToNormalMode();
          }}
        />
        <div className={`map-graph-body${isDrawerOpen ? ' is-drawer-open' : ''}`}>
          <div className="graph-stage">
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
                  Save view
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
                    setSandboxDirty(false);
                    setPendingSandboxFilterHint(true);
                  }
                  setYear(y);
                  setApplicationIds(appIds);
                  setBusinessUnitIds(buIds);
                  setRegionCodes(codes);
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
                aria-label={isDrawerOpen ? 'Close edit panel' : 'Open edit panel'}
              >
                <span className="graph-drawer-toggle-label">Edit</span>
                <span className="graph-drawer-toggle-icon" aria-hidden="true">
                  {isDrawerOpen ? 'Close' : 'Open'}
                </span>
              </button>
            </div>

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

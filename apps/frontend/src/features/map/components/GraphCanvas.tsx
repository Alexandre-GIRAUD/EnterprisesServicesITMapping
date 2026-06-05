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
import { useNavigate } from 'react-router-dom';
import type {
  ApplicationResponse,
  BusinessUnitListItem,
  GraphEdgeCreateResponse,
  GraphNodeDto,
  RegionSummary,
} from '@/types/api';
import { fetchApplications } from '../api/applicationsApi';
import { fetchBusinessUnits } from '../api/businessUnitsApi';
import { fetchRegions } from '../api/regionsApi';
import { fetchGraph } from '../api/graphApi';
import { WorkspaceDrawer } from './WorkspaceDrawer';
import { FilterDrawer } from './FilterDrawer';
import { ApplicationDetailsDrawer } from './ApplicationDetailsDrawer';
import { ApplicationsTablePanel } from './ApplicationsTablePanel';
import { layoutGraph } from './graphLayout';
import { elkLayout } from './elkLayout';
import { snapDraggedNodeForStraighterEdges } from './alignNodes';
import { computeBridges } from './bridges';
import { GraphLegend } from './GraphLegend';
import { AppGraphNode, type AppGraphNodeType } from './AppGraphNode';
import { OrientedEdge } from './OrientedEdge';
import { buildOrientedEdge, attachRoute } from './orientedEdgeBuilders';
import { computeFocus } from './graphFocus';

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
  edge: { id: string; sourceId: string; targetId: string; type: string },
  typeById: Map<string, string>
) {
  return buildOrientedEdge({
    id: edge.id,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    relationType: edge.type,
    sourceNodeType: typeById.get(edge.sourceId) ?? 'Application',
    targetNodeType: typeById.get(edge.targetId) ?? 'Application',
  });
}

/**
 * Graphe des applications et dépendances (React Flow), alimenté par GET /api/graph.
 */
export function GraphCanvas() {
  const navigate = useNavigate();
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
  const filtersActive =
    year != null ||
    applicationIds.length > 0 ||
    businessUnitIds.length > 0 ||
    regionCodes.length > 0;

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

        const typeById = new Map(data.nodes.map((n) => [n.id, n.type]));
        const baseNodes = data.nodes.map(buildAppNode);
        const builtEdges = data.edges.map((e) => buildAppEdge(e, typeById));
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

        requestAnimationFrame(() => {
          rfRef.current?.fitView({ padding: 0.1 });
        });

        setStatus('ready');
        const emptyHint =
          data.nodes.length === 0
            ? filtersActive
              ? 'Aucune application pour ces filtres (année / business unit / location). Changez de critères ou réinitialisez.'
              : 'Aucun nœud. Démarrez le backend avec Neo4j pour charger les données de démo.'
            : 'Astuce : cliquez sur une application pour ouvrir le graphe de ses modules.';
        setMessage(emptyHint);
      } catch (e) {
        if (!cancelled) {
          setGraphNodes([]);
          setNodes([]);
          setEdges([]);
          setStatus('error');
          let msg = e instanceof Error ? e.message : 'Impossible de charger le graphe';
          if (msg === 'Failed to fetch') {
            msg +=
              ' — le backend est injoignable. En dev Vite, vérifiez VITE_API_PROXY_TARGET (ex. 8081 avec Docker) ou lancez Spring Boot sur le port attendu.';
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
      if (node.data.nodeType === 'Application') {
        navigate(`/map/apps/${encodeURIComponent(node.id)}`);
      }
    },
    [navigate]
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
      return 'Edge créé mais source/target absent du graphe affiché.';
    }

    const typeById = new Map(nodes.map((n) => [n.id, n.data.nodeType]));
    setEdges((prev) => {
      if (prev.some((e) => e.id === created.id)) return prev;
      return [...prev, buildAppEdge(created, typeById)];
    });
    return null;
  }

  /** Remove application node + incident edges from React Flow after successful API delete */
  function handleApplicationDeleted(applicationId: string) {
    setNodes((prev) => prev.filter((n) => n.id !== applicationId));
    setEdges((prev) =>
      prev.filter((e) => e.source !== applicationId && e.target !== applicationId)
    );
    setGraphNodes((prev) => prev.filter((n) => n.id !== applicationId));
    setSelectedApplication(null);
    setIsDetailsDrawerOpen(false);
  }

  return (
    <div className="graph-canvas-wrap">
      {status === 'loading' && (
        <p className="graph-canvas-status" role="status">
          Chargement du graphe…
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
      <div className={`graph-workspace${isDrawerOpen ? ' is-drawer-open' : ''}`}>
        <div className="graph-stage">
          <button
            type="button"
            className="graph-drawer-toggle"
            onClick={() => setIsDrawerOpen((open) => !open)}
            aria-expanded={isDrawerOpen}
            aria-controls="graph-actions-drawer"
          >
            <span className="graph-drawer-toggle-label">Workspace</span>
            <span className="graph-drawer-toggle-icon" aria-hidden="true">
              {isDrawerOpen ? 'Close' : 'Open'}
            </span>
          </button>
          <button
            type="button"
            className="graph-filter-toggle"
            onClick={() => setIsFilterDrawerOpen((open) => !open)}
            aria-expanded={isFilterDrawerOpen}
            aria-controls="graph-filter-drawer"
          >
            <span className="graph-drawer-toggle-label">Filtres</span>
            <span className="graph-drawer-toggle-icon" aria-hidden="true">
              {filtersActive ? 'On' : 'Off'}
            </span>
          </button>

          <button
            type="button"
            className={`graph-details-overlay${isFilterDrawerOpen ? ' is-visible' : ''}`}
            aria-label="Fermer les filtres"
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
              setYear(y);
              setApplicationIds(appIds);
              setBusinessUnitIds(buIds);
              setRegionCodes(codes);
            }}
          />

          <div
            ref={containerRef}
            className="graph-canvas"
            role="img"
            aria-label="Graphe des dépendances entre applications"
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
              nodesConnectable={false}
              elementsSelectable
              snapToGrid
              snapGrid={[GRID, GRID]}
              minZoom={0.25}
              maxZoom={2.5}
              fitView
              fitViewOptions={{ padding: 0.1 }}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#1e293b" gap={GRID} />
              <Controls showInteractive={false} />
              <Panel position="top-left">
                <GraphLegend nodeTypes={['Application']} edgeTypes={['DEPENDS_ON']} />
              </Panel>
            </ReactFlow>
          </div>

          <button
            type="button"
            className={`graph-details-overlay${isDetailsDrawerOpen ? ' is-visible' : ''}`}
            aria-label="Fermer le panneau de détails"
            onClick={() => setIsDetailsDrawerOpen(false)}
          />
          <ApplicationDetailsDrawer
            isOpen={isDetailsDrawerOpen}
            application={selectedApplication}
            onClose={() => setIsDetailsDrawerOpen(false)}
            onOpenModuleGraph={(applicationId) => {
              navigate(`/map/apps/${encodeURIComponent(applicationId)}`);
            }}
            onApplicationDeleted={handleApplicationDeleted}
          />
        </div>

        <button
          type="button"
          className={`graph-drawer-overlay${isDrawerOpen ? ' is-visible' : ''}`}
          aria-label="Fermer le drawer"
          onClick={() => setIsDrawerOpen(false)}
        />
        <WorkspaceDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          onNodeCreated={handleNodeCreated}
          onEdgeCreated={handleEdgeCreated}
          onBusinessUnitsChanged={refreshBusinessUnits}
        />
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

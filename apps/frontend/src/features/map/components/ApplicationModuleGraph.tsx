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
import { fetchModuleGraph } from '../api/graphApi';
import { buildNodeHoverHint } from './moduleNodeCardHtml';
import { ModuleGraphNode, type ModuleNode, type ModuleNodeData } from './ModuleGraphNode';
import { layoutGraph } from './graphLayout';
import {
  EDGE_TYPE_STYLES,
  NODE_TYPE_STYLES,
  type EdgeTypeKey,
  type NodeTypeKey,
} from './graphTheme';
import { elkLayout } from './elkLayout';
import { snapDraggedNodeForStraighterEdges } from './alignNodes';
import { computeBridges } from './bridges';
import { GraphLegend } from './GraphLegend';
import { OrientedEdge } from './OrientedEdge';
import { buildOrientedEdge, attachRoute } from './orientedEdgeBuilders';
import { computeFocus } from './graphFocus';
import { fitGraphView } from './fitGraphView';

const KNOWN_NODE_TYPES = Object.keys(NODE_TYPE_STYLES) as NodeTypeKey[];
const KNOWN_EDGE_TYPES = Object.keys(EDGE_TYPE_STYLES) as EdgeTypeKey[];

type Props = {
  applicationId: string;
};

const APP_NODE_WIDTH = 184;
const MODULE_NODE_WIDTH = 172;
const SHORT_NODE_HEIGHT = 56;
const TALL_NODE_HEIGHT = 96;
const GRID = 16;

/**
 * Module tree graph (GET …/module-graph) rendered with React Flow.
 * Cards are drawn by the {@link ModuleGraphNode} custom node component.
 */
export function ApplicationModuleGraph({ applicationId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rfRef = useRef<ReactFlowInstance<ModuleNode, Edge> | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<ModuleNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [hoverHint, setHoverHint] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const focusedId = hoveredId ?? pinnedId;
  const [legendNodeTypes, setLegendNodeTypes] = useState<NodeTypeKey[]>([]);
  const [legendEdgeTypes, setLegendEdgeTypes] = useState<EdgeTypeKey[]>([]);
  const [layoutRevision, setLayoutRevision] = useState(0);

  const nodeTypes = useMemo<NodeTypes>(() => ({ module: ModuleGraphNode }), []);
  const edgeTypes = useMemo<EdgeTypes>(() => ({ oriented: OrientedEdge }), []);

  const focus = useMemo(
    () => (focusedId ? computeFocus(edges, focusedId) : null),
    [edges, focusedId]
  );

  const displayNodes = useMemo(() => {
    if (!focus) return nodes;
    return nodes.map((n) => ({
      ...n,
      className: focus.nodeIds.has(n.id) ? 'is-focus' : 'is-faded',
    }));
  }, [nodes, focus]);

  const displayEdges = useMemo(() => {
    if (!focus) return edges;
    return edges.map((e) => ({
      ...e,
      className: focus.edgeIds.has(e.id) ? 'is-focus' : 'is-faded',
    }));
  }, [edges, focus]);

  useEffect(() => {
    if (status !== 'ready' || nodes.length === 0 || layoutRevision === 0) return;
    fitGraphView(rfRef.current);
  }, [status, nodes.length, layoutRevision]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setStatus('loading');
      setMessage(null);
      setHoverHint(null);
      try {
        const data = await fetchModuleGraph(applicationId);
        if (cancelled) return;

        const rfNodes: ModuleNode[] = data.nodes.map((n) => {
          const name = n.label?.trim() || n.id;
          const description = n.description?.trim() ?? '';
          const hasDescription = description.length > 0;
          const isApp = n.type === 'Application';
          return {
            id: n.id,
            type: 'module',
            position: { x: 0, y: 0 },
            data: { name, description, nodeType: n.type } satisfies ModuleNodeData,
            width: isApp ? APP_NODE_WIDTH : MODULE_NODE_WIDTH,
            height: hasDescription ? TALL_NODE_HEIGHT : SHORT_NODE_HEIGHT,
          };
        });

        const typeById = new Map(data.nodes.map((n) => [n.id, n.type]));
        const rfEdges = data.edges.map((e) =>
          buildOrientedEdge({
            id: e.id,
            sourceId: e.sourceId,
            targetId: e.targetId,
            relationType: e.type,
            sourceNodeType: typeById.get(e.sourceId) ?? 'Module',
            targetNodeType: typeById.get(e.targetId) ?? 'Module',
          })
        );

        const presentNodeTypes = new Set(data.nodes.map((n) => n.type));
        const presentEdgeTypes = new Set(data.edges.map((e) => e.type));
        setLegendNodeTypes(KNOWN_NODE_TYPES.filter((t) => presentNodeTypes.has(t)));
        setLegendEdgeTypes(KNOWN_EDGE_TYPES.filter((t) => presentEdgeTypes.has(t)));

        const rect = containerRef.current?.getBoundingClientRect();
        const aspectRatio = rect && rect.height > 0 ? rect.width / rect.height : 16 / 9;

        try {
          // Preferred: ELK layered layout with node-avoiding orthogonal routing.
          const { nodes: laidOut, routes } = await elkLayout(rfNodes, rfEdges, {
            nodeWidth: MODULE_NODE_WIDTH,
            nodeHeight: SHORT_NODE_HEIGHT,
            nodeSeparation: 80,
            layerSeparation: 110,
            aspectRatio,
          });
          if (cancelled) return;
          const jumps = computeBridges(routes);
          setNodes(laidOut);
          setEdges(rfEdges.map((e) => attachRoute(e, routes.get(e.id), jumps.get(e.id))));
        } catch {
          // Fallback: dagre layout + smoothstep edges if ELK fails.
          if (cancelled) return;
          setNodes(
            layoutGraph(rfNodes, rfEdges, {
              nodeWidth: MODULE_NODE_WIDTH,
              nodeHeight: SHORT_NODE_HEIGHT,
              nodeSeparation: 80,
              rankSeparation: 110,
              snapGrid: GRID,
              aspectRatio,
            })
          );
          setEdges(rfEdges);
        }

        if (!cancelled) setLayoutRevision((v) => v + 1);

        setStatus('ready');
        setMessage(
          data.nodes.length <= 1 && data.edges.length === 0
            ? 'Aucun module lié à cette application pour l’instant (racine seule).'
            : null
        );
      } catch (e) {
        if (!cancelled) {
          setNodes([]);
          setEdges([]);
          setLegendNodeTypes([]);
          setLegendEdgeTypes([]);
          setStatus('error');
          let msg = e instanceof Error ? e.message : 'Impossible de charger le graphe modules';
          if (msg.includes('404')) {
            msg =
              'Application introuvable ou inactive à cette date (404). Vérifiez l’identifiant ou revenez à la carte.';
          }
          if (msg === 'Failed to fetch') {
            msg +=
              ' — backend injoignable. Vérifiez VITE_API_PROXY_TARGET ou VITE_API_BASE_URL.';
          }
          setMessage(msg);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applicationId, setNodes, setEdges]);

  const handleNodeMouseEnter = useCallback((_: ReactMouseEvent, node: ModuleNode) => {
    setHoverHint(buildNodeHoverHint(node.data.name ?? '', node.data.description ?? ''));
    setHoveredId(node.id);
  }, []);

  const handleNodeMouseLeave = useCallback(() => {
    setHoverHint(null);
    setHoveredId(null);
  }, []);

  const handleNodeClick = useCallback(
    (_: ReactMouseEvent, node: ModuleNode) =>
      setPinnedId((prev) => (prev === node.id ? null : node.id)),
    []
  );

  const handlePaneClick = useCallback(() => setPinnedId(null), []);

  const handleNodeDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, _node: ModuleNode) => {
      setNodes((prev) => {
        const dragged = prev.find((n) => n.id === _node.id);
        if (!dragged) return prev;
        const snapped = snapDraggedNodeForStraighterEdges(dragged.id, prev, edges, {
          nodeWidth: MODULE_NODE_WIDTH,
          nodeHeight: SHORT_NODE_HEIGHT,
        });
        if (!snapped) return prev;
        return prev.map((n) => (n.id === dragged.id ? { ...n, position: snapped } : n));
      });
    },
    [edges, setNodes]
  );

  const hintText = hoverHint ?? (status === 'ready' ? message : null);

  return (
    <div className="graph-canvas-wrap module-graph-wrap">
      {status === 'loading' && (
        <p className="graph-canvas-status" role="status">
          Chargement des modules…
        </p>
      )}
      {status === 'error' && message && (
        <p className="graph-canvas-error" role="alert">
          {message}
        </p>
      )}
      {hintText && status !== 'error' && (
        <p className="graph-canvas-hint module-graph-hint" title={hoverHint ?? undefined}>
          {hintText}
        </p>
      )}
      <div
        ref={containerRef}
        className="graph-canvas module-graph-canvas"
        role="img"
        aria-label="Graphe des modules de l’application"
      >
        <ReactFlow<ModuleNode, Edge>
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
          onNodeMouseEnter={handleNodeMouseEnter}
          onNodeMouseLeave={handleNodeMouseLeave}
          onNodeDragStop={handleNodeDragStop}
          onPaneClick={handlePaneClick}
          nodesDraggable
          nodesConnectable={false}
          snapToGrid
          snapGrid={[GRID, GRID]}
          minZoom={0.05}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#1e293b" gap={GRID} />
          <Controls showInteractive={false} />
          {(legendNodeTypes.length > 0 || legendEdgeTypes.length > 0) && (
            <Panel position="top-left">
              <GraphLegend nodeTypes={legendNodeTypes} edgeTypes={legendEdgeTypes} />
            </Panel>
          )}
        </ReactFlow>
      </div>
    </div>
  );
}

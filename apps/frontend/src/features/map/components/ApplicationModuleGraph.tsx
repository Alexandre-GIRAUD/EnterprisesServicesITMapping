import {
  Background,
  Controls,
  Panel,
  ReactFlow,
  useNodesState,
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
import { ModuleGraphNode, type ModuleNode } from './ModuleGraphNode';
import { NODE_TYPE_STYLES, type NodeTypeKey } from './graphTheme';
import { GraphLegend } from './GraphLegend';
import { fitGraphView } from './fitGraphView';
import {
  buildModuleNestedNodes,
  collectDescendants,
  type ModuleTree,
} from './moduleNestedLayout';

const KNOWN_NODE_TYPES = Object.keys(NODE_TYPE_STYLES) as NodeTypeKey[];
const GRID = 16;

type Props = {
  applicationId: string;
};

/**
 * Module composition view (GET …/module-graph) as nested boxes inside the
 * application container. CONTAINS edges drive hierarchy only — nothing is drawn.
 */
export function ApplicationModuleGraph({ applicationId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rfRef = useRef<ReactFlowInstance<ModuleNode, never> | null>(null);
  const treeRef = useRef<ModuleTree | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<ModuleNode>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [hoverHint, setHoverHint] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const focusedId = hoveredId ?? pinnedId;
  const [legendNodeTypes, setLegendNodeTypes] = useState<NodeTypeKey[]>([]);
  const [layoutRevision, setLayoutRevision] = useState(0);

  const nodeTypes = useMemo<NodeTypes>(() => ({ module: ModuleGraphNode }), []);

  const focusNodeIds = useMemo(() => {
    if (!focusedId || !treeRef.current) return null;
    return collectDescendants(focusedId, treeRef.current.childrenByParent);
  }, [focusedId]);

  const displayNodes = useMemo(() => {
    if (!focusNodeIds) return nodes;
    return nodes.map((n) => ({
      ...n,
      className: focusNodeIds.has(n.id) ? 'is-focus' : 'is-faded',
    }));
  }, [nodes, focusNodeIds]);

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

        const { rfNodes, tree } = buildModuleNestedNodes(data.nodes, data.edges);
        treeRef.current = tree;

        const presentNodeTypes = new Set(data.nodes.map((n) => n.type));
        setLegendNodeTypes(KNOWN_NODE_TYPES.filter((t) => presentNodeTypes.has(t)));

        setNodes(rfNodes);
        if (!cancelled) setLayoutRevision((v) => v + 1);

        setStatus('ready');
        setMessage(
          data.nodes.length <= 1 && data.edges.length === 0
            ? 'No modules linked to this application yet (root only).'
            : null
        );
      } catch (e) {
        if (!cancelled) {
          treeRef.current = null;
          setNodes([]);
          setLegendNodeTypes([]);
          setStatus('error');
          let msg = e instanceof Error ? e.message : 'Unable to load the module graph';
          if (msg.includes('404')) {
            msg =
              'Application not found or inactive at this date (404). Check the ID or return to the map.';
          }
          if (msg === 'Failed to fetch') {
            msg +=
              ' — backend unreachable. Check VITE_API_PROXY_TARGET or VITE_API_BASE_URL.';
          }
          setMessage(msg);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applicationId, setNodes]);

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

  const hintText = hoverHint ?? (status === 'ready' ? message : null);

  return (
    <div className="graph-canvas-wrap module-graph-wrap">
      {status === 'loading' && (
        <p className="graph-canvas-status" role="status">
          Loading modules…
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
        aria-label="Application module graph"
      >
        <ReactFlow<ModuleNode, never>
          nodes={displayNodes}
          edges={[]}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onInit={(instance) => {
            rfRef.current = instance;
          }}
          onNodeClick={handleNodeClick}
          onNodeMouseEnter={handleNodeMouseEnter}
          onNodeMouseLeave={handleNodeMouseLeave}
          onPaneClick={handlePaneClick}
          nodesDraggable
          nodesConnectable={false}
          snapToGrid
          snapGrid={[GRID, GRID]}
          minZoom={0.05}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#e2e8f0" gap={GRID} />
          <Controls showInteractive={false} />
          {legendNodeTypes.length > 0 && (
            <Panel position="top-left">
              <GraphLegend nodeTypes={legendNodeTypes} />
            </Panel>
          )}
        </ReactFlow>
      </div>
    </div>
  );
}

import {
  useEdgesState,
  useNodesState,
  type Edge,
  type ReactFlowInstance,
} from '@xyflow/react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from 'react';
import type { GraphEdgeDto, GraphNodeDto } from '@/types/api';
import { fetchGraph } from '../api/graphApi';
import { layoutGraph } from '../components/graphLayout';
import { elkLayout } from '../components/elkLayout';
import { computeBridges } from '../components/bridges';
import {
  collectLegendColorValues,
  colorPropertyOptions,
  loadStoredColorPropertyKey,
  resolveColorPropertyKey,
  storeColorPropertyKey,
} from '../components/edgeColorProperty';
import type { AppGraphNodeType } from '../components/AppGraphNode';
import {
  buildOrientedEdge,
  attachRoute,
  restyleEdgeColorProperty,
} from '../components/orientedEdgeBuilders';
import type { OrientedEdgeType } from '../components/OrientedEdge';
import { fitGraphView } from '../components/fitGraphView';
import type { GraphMode } from '../components/GraphModeTabs';

export type AppNode = AppGraphNodeType;

export const NODE_WIDTH = 160;
export const NODE_HEIGHT = 48;
export const GRID = 16;

export function buildAppNode(node: GraphNodeDto): AppNode {
  return {
    id: node.id,
    type: 'app',
    position: { x: 0, y: 0 },
    data: { label: node.label, nodeType: node.type },
    className: 'graph-node',
  };
}

export function buildAppEdge(
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

type UseGraphDataParams = {
  year: number | null;
  applicationIds: string[];
  businessUnitIds: string[];
  regionCodes: string[];
  filtersActive: boolean;
  graphReloadNonce: number;
  graphModeRef: MutableRefObject<GraphMode>;
  pendingSandboxFilterHint: boolean;
  setPendingSandboxFilterHint: Dispatch<SetStateAction<boolean>>;
  setMessage: Dispatch<SetStateAction<string | null>>;
  containerRef: RefObject<HTMLDivElement>;
  rfRef: MutableRefObject<ReactFlowInstance<AppNode, Edge> | null>;
};

/**
 * Owns the React Flow node/edge state and the data pipeline: fetch graph for
 * the active filters, run ELK (with a dagre fallback) layout, then expose the
 * laid-out graph plus the color-property legend state.
 */
export function useGraphData({
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
}: UseGraphDataParams) {
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [graphNodes, setGraphNodes] = useState<GraphNodeDto[]>([]);
  const [graphEdges, setGraphEdges] = useState<GraphEdgeDto[]>([]);
  const graphEdgesRef = useRef(graphEdges);
  graphEdgesRef.current = graphEdges;
  const [colorPropertyKey, setColorPropertyKey] = useState(loadStoredColorPropertyKey);
  const [layoutRevision, setLayoutRevision] = useState(0);

  const legendColorPropertyOptions = useMemo(
    () => colorPropertyOptions(graphEdges),
    [graphEdges]
  );
  const legendColorValues = useMemo(
    () => collectLegendColorValues(graphEdges, colorPropertyKey),
    [graphEdges, colorPropertyKey]
  );

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

  // Fit the full diagram once nodes are rendered (double rAF inside fitGraphView).
  useEffect(() => {
    if (status !== 'ready' || nodes.length === 0 || layoutRevision === 0) return;
    fitGraphView(rfRef.current);
  }, [status, nodes.length, layoutRevision, rfRef]);

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
                ? 'Impact Sandbox — customize your graph, no changes saved.'
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

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally re-fetch only on filters / reload nonce
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

  return {
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
    setColorPropertyKey,
    handleColorPropertyChange,
    legendColorPropertyOptions,
    legendColorValues,
  };
}

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
  collectNodeLegendValues,
  colorPropertyOptions,
  loadStoredAppBorderKey,
  loadStoredAppFillKey,
  loadStoredColorPropertyKey,
  loadStoredLabelPropertyKey,
  nodeBorderColor,
  nodeFillColor,
  nodePropertyOptions,
  resolveColorPropertyKey,
  resolveNodePropertyKey,
  storeAppBorderKey,
  storeAppFillKey,
  storeColorPropertyKey,
  storeLabelPropertyKey,
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

export type NodeCodingKeys = {
  appFillKey: string;
  appBorderKey: string;
};

/** Build RF node with visual-only fill/border (reads DTO; never writes properties). */
export function buildAppNode(node: GraphNodeDto, coding?: NodeCodingKeys): AppNode {
  return {
    id: node.id,
    type: 'app',
    position: { x: 0, y: 0 },
    data: {
      label: node.label,
      nodeType: node.type,
      ...(coding
        ? {
            fillColor: nodeFillColor(node, coding.appFillKey),
            borderColor: nodeBorderColor(node, coding.appBorderKey),
          }
        : {}),
    },
    className: 'graph-node',
  };
}

export function buildAppEdge(
  edge: GraphEdgeDto,
  typeById: Map<string, string>,
  colorPropertyKey: string,
  labelPropertyKey = 'data'
) {
  return buildOrientedEdge({
    id: edge.id,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    relationType: edge.type,
    dataLabel: edge.data,
    colorPropertyKey,
    labelPropertyKey,
    properties: edge.properties,
    sourceNodeType: typeById.get(edge.sourceId) ?? 'Application',
    targetNodeType: typeById.get(edge.targetId) ?? 'Application',
  });
}

function applyNodeCoding(
  nodes: AppNode[],
  graphNodes: GraphNodeDto[],
  coding: NodeCodingKeys
): AppNode[] {
  const byId = new Map(graphNodes.map((n) => [n.id, n]));
  return nodes.map((node) => {
    const dto = byId.get(node.id);
    if (!dto) return node;
    return {
      ...node,
      data: {
        ...node.data,
        fillColor: nodeFillColor(dto, coding.appFillKey),
        borderColor: nodeBorderColor(dto, coding.appBorderKey),
      },
    };
  });
}

type UseGraphDataParams = {
  applicationIds: string[];
  nodeAttributes: Record<string, string[]>;
  nodeRefs: Record<string, string[]>;
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
 * Graph fetch + layout + legend coding (display-only; never mutates DTO properties).
 */
export function useGraphData({
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
}: UseGraphDataParams) {
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [graphNodes, setGraphNodes] = useState<GraphNodeDto[]>([]);
  const [graphEdges, setGraphEdges] = useState<GraphEdgeDto[]>([]);
  const graphEdgesRef = useRef(graphEdges);
  graphEdgesRef.current = graphEdges;
  const graphNodesRef = useRef(graphNodes);
  graphNodesRef.current = graphNodes;

  const [colorPropertyKey, setColorPropertyKey] = useState(loadStoredColorPropertyKey);
  const [labelPropertyKey, setLabelPropertyKey] = useState(loadStoredLabelPropertyKey);
  const [appFillKey, setAppFillKey] = useState(loadStoredAppFillKey);
  const [appBorderKey, setAppBorderKey] = useState(loadStoredAppBorderKey);
  const [layoutRevision, setLayoutRevision] = useState(0);

  const legendColorPropertyOptions = useMemo(
    () => colorPropertyOptions(graphEdges),
    [graphEdges]
  );
  const legendLabelPropertyOptions = legendColorPropertyOptions;
  const legendAppPropertyOptions = useMemo(
    () => nodePropertyOptions(graphNodes),
    [graphNodes]
  );

  const legendColorValues = useMemo(
    () => collectLegendColorValues(graphEdges, colorPropertyKey),
    [graphEdges, colorPropertyKey]
  );
  const legendFillValues = useMemo(
    () => collectNodeLegendValues(graphNodes, appFillKey),
    [graphNodes, appFillKey]
  );
  const legendBorderValues = useMemo(
    () => collectNodeLegendValues(graphNodes, appBorderKey),
    [graphNodes, appBorderKey]
  );

  const handleColorPropertyChange = useCallback((key: string) => {
    setColorPropertyKey(key);
    storeColorPropertyKey(key);
  }, []);
  const handleLabelPropertyChange = useCallback((key: string) => {
    setLabelPropertyKey(key);
    storeLabelPropertyKey(key);
  }, []);
  const handleAppFillChange = useCallback((key: string) => {
    setAppFillKey(key);
    storeAppFillKey(key);
  }, []);
  const handleAppBorderChange = useCallback((key: string) => {
    setAppBorderKey(key);
    storeAppBorderKey(key);
  }, []);

  useEffect(() => {
    if (status !== 'ready') return;
    setEdges((prev) => {
      if (prev.length === 0) return prev;
      const byId = new Map(graphEdgesRef.current.map((edge) => [edge.id, edge]));
      return prev.map((edge) =>
        restyleEdgeColorProperty(
          edge as OrientedEdgeType,
          colorPropertyKey,
          byId.get(edge.id),
          labelPropertyKey
        )
      );
    });
  }, [colorPropertyKey, labelPropertyKey, status, setEdges]);

  useEffect(() => {
    if (status !== 'ready') return;
    setNodes((prev) => {
      if (prev.length === 0) return prev;
      return applyNodeCoding(prev, graphNodesRef.current, { appFillKey, appBorderKey });
    });
  }, [appFillKey, appBorderKey, status, setNodes]);

  useEffect(() => {
    if (status !== 'ready' || layoutRevision === 0) return;
    fitGraphView(rfRef.current);
  }, [status, layoutRevision, rfRef]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setStatus('loading');
        setMessage(null);
        const data = await fetchGraph({
          applicationIds: applicationIds.length > 0 ? applicationIds : undefined,
          nodeAttributes: Object.keys(nodeAttributes).length > 0 ? nodeAttributes : undefined,
          nodeRefs: Object.keys(nodeRefs).length > 0 ? nodeRefs : undefined,
        });
        if (cancelled) return;

        setGraphNodes(data.nodes);
        setGraphEdges(data.edges);

        const effectiveColorKey = resolveColorPropertyKey(colorPropertyKey, data.edges);
        const effectiveLabelKey = resolveColorPropertyKey(labelPropertyKey, data.edges);
        const effectiveFillKey = resolveNodePropertyKey(appFillKey, data.nodes);
        const effectiveBorderKey = resolveNodePropertyKey(appBorderKey, data.nodes);

        if (effectiveColorKey !== colorPropertyKey) {
          setColorPropertyKey(effectiveColorKey);
          storeColorPropertyKey(effectiveColorKey);
        }
        if (effectiveLabelKey !== labelPropertyKey) {
          setLabelPropertyKey(effectiveLabelKey);
          storeLabelPropertyKey(effectiveLabelKey);
        }
        if (effectiveFillKey !== appFillKey) {
          setAppFillKey(effectiveFillKey);
          storeAppFillKey(effectiveFillKey);
        }
        if (effectiveBorderKey !== appBorderKey) {
          setAppBorderKey(effectiveBorderKey);
          storeAppBorderKey(effectiveBorderKey);
        }

        const typeById = new Map(data.nodes.map((n) => [n.id, n.type]));
        const nodeCoding: NodeCodingKeys = {
          appFillKey: effectiveFillKey,
          appBorderKey: effectiveBorderKey,
        };
        const baseNodes = data.nodes.map((n) => buildAppNode(n, nodeCoding));
        const builtEdges = data.edges.map((e) =>
          buildAppEdge(e, typeById, effectiveColorKey, effectiveLabelKey)
        );
        const rect = containerRef.current?.getBoundingClientRect();
        const aspectRatio = rect && rect.height > 0 ? rect.width / rect.height : 16 / 9;

        try {
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
                ? 'No applications match these filters. Change criteria or reset.'
                : 'No nodes. Start the backend with Neo4j to load demo data.'
              : graphModeRef.current === 'sandbox'
                ? 'Sandbox — customize your graph, no changes saved.'
                : 'Tip: double-click an application to open its module graph. Single-click for details.';
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
    applicationIds,
    nodeAttributes,
    nodeRefs,
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
    labelPropertyKey,
    appFillKey,
    appBorderKey,
    handleColorPropertyChange,
    handleLabelPropertyChange,
    handleAppFillChange,
    handleAppBorderChange,
    legendColorPropertyOptions,
    legendLabelPropertyOptions,
    legendAppPropertyOptions,
    legendColorValues,
    legendFillValues,
    legendBorderValues,
  };
}

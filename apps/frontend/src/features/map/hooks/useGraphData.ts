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
  isSimpleLegendMode,
  loadHideEdgeLabels,
  loadLegendColorMaps,
  loadLegendSetups,
  loadStoredAppBorderKey,
  loadStoredAppFillKey,
  loadStoredColorPropertyKey,
  loadStoredLabelPropertyKey,
  NODE_TYPE_COLOR_KEY,
  nodeBorderColor,
  nodeFillColor,
  nodePropertyOptions,
  RELATION_TYPE_COLOR_KEY,
  resolveColorPropertyKey,
  resolveNodePropertyKey,
  setRationalizedColorInMaps,
  storeAppBorderKey,
  storeAppFillKey,
  storeColorPropertyKey,
  storeHideEdgeLabels,
  storeLabelPropertyKey,
  storeLegendColorMaps,
  storeLegendSetups,
  visibleGraphElements,
  type GraphLegendSnapshot,
  type LegendColorMaps,
  type LegendSetup,
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
  colors?: LegendColorMaps;
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
            fillColor: nodeFillColor(node, coding.appFillKey, coding.colors?.appFill),
            borderColor: nodeBorderColor(
              node,
              coding.appBorderKey,
              coding.colors?.appBorder,
              coding.appFillKey,
              coding.colors?.appFill
            ),
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
  labelPropertyKey = 'data',
  colors?: LegendColorMaps,
  hideEdgeLabels?: boolean
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
    colors,
    hideEdgeLabels,
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
        fillColor: nodeFillColor(dto, coding.appFillKey, coding.colors?.appFill),
        borderColor: nodeBorderColor(
          dto,
          coding.appBorderKey,
          coding.colors?.appBorder,
          coding.appFillKey,
          coding.colors?.appFill
        ),
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
  hiddenNodeIds?: ReadonlySet<string>;
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
  hiddenNodeIds = new Set(),
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
  const [legendColors, setLegendColors] = useState<LegendColorMaps>(loadLegendColorMaps);
  const legendColorsRef = useRef(legendColors);
  legendColorsRef.current = legendColors;
  const [hideEdgeLabels, setHideEdgeLabels] = useState(loadHideEdgeLabels);
  const hideEdgeLabelsRef = useRef(hideEdgeLabels);
  hideEdgeLabelsRef.current = hideEdgeLabels;
  const [legendSetups, setLegendSetups] = useState<LegendSetup[]>(loadLegendSetups);
  const [layoutRevision, setLayoutRevision] = useState(0);

  const visible = useMemo(
    () => visibleGraphElements(graphNodes, graphEdges, hiddenNodeIds),
    [graphNodes, graphEdges, hiddenNodeIds]
  );

  const simpleMode = useMemo(
    () => isSimpleLegendMode(visible.nodes, visible.edges),
    [visible.nodes, visible.edges]
  );

  const effectiveColorKey = simpleMode ? RELATION_TYPE_COLOR_KEY : colorPropertyKey;
  const effectiveLabelKey = simpleMode ? RELATION_TYPE_COLOR_KEY : labelPropertyKey;
  const effectiveFillKey = simpleMode ? NODE_TYPE_COLOR_KEY : appFillKey;
  const effectiveBorderKey = simpleMode ? NODE_TYPE_COLOR_KEY : appBorderKey;

  const legendColorPropertyOptions = useMemo(
    () => colorPropertyOptions(visible.edges),
    [visible.edges]
  );
  const legendLabelPropertyOptions = legendColorPropertyOptions;
  const legendAppPropertyOptions = useMemo(
    () => nodePropertyOptions(visible.nodes),
    [visible.nodes]
  );

  const legendColorValues = useMemo(
    () => collectLegendColorValues(visible.edges, effectiveColorKey),
    [visible.edges, effectiveColorKey]
  );
  const legendLabelValues = useMemo(
    () => collectLegendColorValues(visible.edges, effectiveLabelKey),
    [visible.edges, effectiveLabelKey]
  );
  const legendFillValues = useMemo(
    () => collectNodeLegendValues(visible.nodes, effectiveFillKey),
    [visible.nodes, effectiveFillKey]
  );
  const legendBorderValues = useMemo(
    () => collectNodeLegendValues(visible.nodes, effectiveBorderKey),
    [visible.nodes, effectiveBorderKey]
  );

  // Resolve keys when options shrink (filters / hide).
  useEffect(() => {
    if (simpleMode) return;
    const nextColor = resolveColorPropertyKey(colorPropertyKey, visible.edges);
    const nextLabel = resolveColorPropertyKey(labelPropertyKey, visible.edges);
    const nextFill = resolveNodePropertyKey(appFillKey, visible.nodes);
    const nextBorder = resolveNodePropertyKey(appBorderKey, visible.nodes);
    if (nextColor !== colorPropertyKey) {
      setColorPropertyKey(nextColor);
      storeColorPropertyKey(nextColor);
    }
    if (nextLabel !== labelPropertyKey) {
      setLabelPropertyKey(nextLabel);
      storeLabelPropertyKey(nextLabel);
    }
    if (nextFill !== appFillKey) {
      setAppFillKey(nextFill);
      storeAppFillKey(nextFill);
    }
    if (nextBorder !== appBorderKey) {
      setAppBorderKey(nextBorder);
      storeAppBorderKey(nextBorder);
    }
  }, [
    simpleMode,
    visible.edges,
    visible.nodes,
    colorPropertyKey,
    labelPropertyKey,
    appFillKey,
    appBorderKey,
  ]);

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

  const handleValueColorChange = useCallback(
    (channel: keyof LegendColorMaps, value: string, color: string) => {
      setLegendColors((prev) => {
        const next = setRationalizedColorInMaps(
          prev,
          channel,
          value,
          color,
          effectiveColorKey,
          effectiveLabelKey,
          effectiveFillKey,
          effectiveBorderKey
        );
        storeLegendColorMaps(next);
        return next;
      });
    },
    [effectiveColorKey, effectiveLabelKey, effectiveFillKey, effectiveBorderKey]
  );

  const handleHideEdgeLabelsChange = useCallback((hide: boolean) => {
    setHideEdgeLabels(hide);
    storeHideEdgeLabels(hide);
  }, []);

  const getLegendSnapshot = useCallback((): GraphLegendSnapshot => {
    return {
      edgeColorKey: effectiveColorKey,
      edgeLabelKey: effectiveLabelKey,
      appFillKey: effectiveFillKey,
      appBorderKey: effectiveBorderKey,
      colors: legendColorsRef.current,
      hideEdgeLabels: hideEdgeLabelsRef.current,
    };
  }, [effectiveColorKey, effectiveLabelKey, effectiveFillKey, effectiveBorderKey]);

  const applyLegendSnapshot = useCallback((legend: GraphLegendSnapshot | null | undefined) => {
    if (!legend) return;
    if (legend.edgeColorKey) {
      setColorPropertyKey(legend.edgeColorKey);
      storeColorPropertyKey(legend.edgeColorKey);
    }
    if (legend.edgeLabelKey) {
      setLabelPropertyKey(legend.edgeLabelKey);
      storeLabelPropertyKey(legend.edgeLabelKey);
    }
    if (legend.appFillKey) {
      setAppFillKey(legend.appFillKey);
      storeAppFillKey(legend.appFillKey);
    }
    if (legend.appBorderKey) {
      setAppBorderKey(legend.appBorderKey);
      storeAppBorderKey(legend.appBorderKey);
    }
    const colors = legend.colors ?? {};
    // Sync refs before any immediate relayout/restyle that reads them.
    legendColorsRef.current = colors;
    setLegendColors(colors);
    storeLegendColorMaps(colors);
    const hide = Boolean(legend.hideEdgeLabels);
    hideEdgeLabelsRef.current = hide;
    setHideEdgeLabels(hide);
    storeHideEdgeLabels(hide);
  }, []);

  const saveLegendSetup = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setLegendSetups((prev) => {
        const next: LegendSetup[] = [
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: trimmed,
            edgeColorKey: effectiveColorKey,
            edgeLabelKey: effectiveLabelKey,
            appFillKey: effectiveFillKey,
            appBorderKey: effectiveBorderKey,
            colors: legendColorsRef.current,
            hideEdgeLabels: hideEdgeLabelsRef.current,
          },
        ];
        storeLegendSetups(next);
        return next;
      });
    },
    [effectiveColorKey, effectiveLabelKey, effectiveFillKey, effectiveBorderKey]
  );

  const applyLegendSetup = useCallback((setup: LegendSetup) => {
    applyLegendSnapshot(setup);
  }, [applyLegendSnapshot]);

  const deleteLegendSetup = useCallback((id: string) => {
    setLegendSetups((prev) => {
      const next = prev.filter((s) => s.id !== id);
      storeLegendSetups(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (status !== 'ready') return;
    setEdges((prev) => {
      if (prev.length === 0) return prev;
      const byId = new Map(graphEdgesRef.current.map((edge) => [edge.id, edge]));
      const colors = legendColorsRef.current;
      const hide = hideEdgeLabelsRef.current;
      return prev.map((edge) =>
        restyleEdgeColorProperty(
          edge as OrientedEdgeType,
          effectiveColorKey,
          byId.get(edge.id),
          effectiveLabelKey,
          colors,
          hide
        )
      );
    });
  }, [effectiveColorKey, effectiveLabelKey, legendColors, hideEdgeLabels, status, setEdges]);

  useEffect(() => {
    if (status !== 'ready') return;
    setNodes((prev) => {
      if (prev.length === 0) return prev;
      return applyNodeCoding(prev, graphNodesRef.current, {
        appFillKey: effectiveFillKey,
        appBorderKey: effectiveBorderKey,
        colors: legendColorsRef.current,
      });
    });
  }, [effectiveFillKey, effectiveBorderKey, legendColors, status, setNodes]);

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

        const simple = isSimpleLegendMode(data.nodes, data.edges);
        const nextColor = simple
          ? RELATION_TYPE_COLOR_KEY
          : resolveColorPropertyKey(colorPropertyKey, data.edges);
        const nextLabel = simple
          ? RELATION_TYPE_COLOR_KEY
          : resolveColorPropertyKey(labelPropertyKey, data.edges);
        const nextFill = simple
          ? NODE_TYPE_COLOR_KEY
          : resolveNodePropertyKey(appFillKey, data.nodes);
        const nextBorder = simple
          ? NODE_TYPE_COLOR_KEY
          : resolveNodePropertyKey(appBorderKey, data.nodes);

        if (nextColor !== colorPropertyKey) {
          setColorPropertyKey(nextColor);
          storeColorPropertyKey(nextColor);
        }
        if (nextLabel !== labelPropertyKey) {
          setLabelPropertyKey(nextLabel);
          storeLabelPropertyKey(nextLabel);
        }
        if (nextFill !== appFillKey) {
          setAppFillKey(nextFill);
          storeAppFillKey(nextFill);
        }
        if (nextBorder !== appBorderKey) {
          setAppBorderKey(nextBorder);
          storeAppBorderKey(nextBorder);
        }

        const colors = legendColorsRef.current;
        const typeById = new Map(data.nodes.map((n) => [n.id, n.type]));
        const nodeCoding: NodeCodingKeys = {
          appFillKey: nextFill,
          appBorderKey: nextBorder,
          colors,
        };
        const baseNodes = data.nodes.map((n) => buildAppNode(n, nodeCoding));
        const builtEdges = data.edges.map((e) =>
          buildAppEdge(e, typeById, nextColor, nextLabel, colors, hideEdgeLabelsRef.current)
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
    simpleMode,
    colorPropertyKey: effectiveColorKey,
    labelPropertyKey: effectiveLabelKey,
    appFillKey: effectiveFillKey,
    appBorderKey: effectiveBorderKey,
    legendColors,
    hideEdgeLabels,
    handleColorPropertyChange,
    handleLabelPropertyChange,
    handleAppFillChange,
    handleAppBorderChange,
    handleValueColorChange,
    handleHideEdgeLabelsChange,
    getLegendSnapshot,
    applyLegendSnapshot,
    legendColorPropertyOptions,
    legendLabelPropertyOptions,
    legendAppPropertyOptions,
    legendColorValues,
    legendLabelValues,
    legendFillValues,
    legendBorderValues,
    legendSetups,
    saveLegendSetup,
    applyLegendSetup,
    deleteLegendSetup,
  };
}

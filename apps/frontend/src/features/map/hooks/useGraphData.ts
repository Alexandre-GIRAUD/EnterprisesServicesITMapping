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
import { placeApplicationGraph } from '../components/graphvizLayout';
import { computeBridges, spreadStackedRoutes } from '../components/bridges';
import {
  collectLegendColorValues,
  collectNodeLegendValues,
  colorPropertyOptions,
  edgeColorValue,
  isSimpleLegendMode,
  loadHideEdgeLabels,
  loadLegendColorMaps,
  loadLegendSetups,
  loadBorderPropertyChosen,
  loadFillPropertyChosen,
  loadStoredAppBorderKey,
  loadStoredAppFillKey,
  loadStoredAppTextKey,
  loadTextPropertyChosen,
  loadStoredColorPropertyKey,
  loadStrokePropertyChosen,
  loadLabelPropertyChosen,
  loadStoredLabelPropertyKey,
  NODE_TYPE_COLOR_KEY,
  nodeBorderColor,
  nodeFillColor,
  nodeTextColor,
  nodePropertyOptions,
  paintChannelColors,
  paintEdgeStrokeColor,
  RELATION_TYPE_COLOR_KEY,
  HIDE_EDGE_LABELS_KEY,
  resolveMirroredLabelKey,
  resolveSpreadColorKeys,
  setRationalizedColorInMaps,
  storeAppBorderKey,
  storeAppFillKey,
  storeAppTextKey,
  storeTextPropertyChosen,
  storeBorderPropertyChosen,
  storeColorPropertyKey,
  storeFillPropertyChosen,
  storeHideEdgeLabels,
  storeLabelPropertyChosen,
  storeLabelPropertyKey,
  storeLegendColorMaps,
  storeLegendSetups,
  storeStrokePropertyChosen,
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

export type AppNode = AppGraphNodeType;

export const NODE_WIDTH = 160;
export const NODE_HEIGHT = 48;
export const GRID = 16;

export type NodeCodingKeys = {
  appFillKey: string;
  appBorderKey: string;
  appTextKey?: string;
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
            textColor: nodeTextColor(
              node,
              coding.appTextKey ?? coding.appBorderKey,
              coding.colors?.appText,
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
        textColor: nodeTextColor(
          dto,
          coding.appTextKey ?? coding.appBorderKey,
          coding.colors?.appText,
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
  edgeAttributes: Record<string, string[]>;
  edgeIds?: string[];
  matchNothing?: boolean;
  filtersActive: boolean;
  graphReloadNonce: number;
  hiddenNodeIds?: ReadonlySet<string>;
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
  edgeAttributes,
  edgeIds = [],
  matchNothing = false,
  filtersActive,
  graphReloadNonce,
  hiddenNodeIds = new Set(),
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
  const [appTextKey, setAppTextKey] = useState(loadStoredAppTextKey);
  const fillChosenRef = useRef(loadFillPropertyChosen());
  const borderChosenRef = useRef(loadBorderPropertyChosen());
  const textChosenRef = useRef(loadTextPropertyChosen());
  const strokeChosenRef = useRef(loadStrokePropertyChosen());
  const labelChosenRef = useRef(loadLabelPropertyChosen());
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
  const effectiveTextKey = simpleMode ? NODE_TYPE_COLOR_KEY : appTextKey;

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
  const legendTextValues = useMemo(
    () => collectNodeLegendValues(visible.nodes, effectiveTextKey),
    [visible.nodes, effectiveTextKey]
  );
  const displayColors = useMemo(
    () =>
      paintChannelColors({
        colors: legendColors,
        fillKey: effectiveFillKey,
        fillValues: legendFillValues,
        strokeKey: effectiveColorKey,
        strokeValues: legendColorValues,
        borderKey: effectiveBorderKey,
        textKey: effectiveTextKey,
        textValues: legendTextValues,
      }),
    [
      legendColors,
      effectiveFillKey,
      legendFillValues,
      effectiveColorKey,
      legendColorValues,
      effectiveBorderKey,
      effectiveTextKey,
      legendTextValues,
    ]
  );

  /** Stroke color of an edge that carries each label value (label text color = stroke). */
  const legendLabelStrokeColors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const edge of visible.edges) {
      const labelValue = edgeColorValue(edge, effectiveLabelKey);
      if (!labelValue || map[labelValue]) continue;
      const strokeValue = edgeColorValue(edge, effectiveColorKey);
      map[labelValue] = paintEdgeStrokeColor(
        strokeValue,
        edge.type,
        effectiveColorKey,
        displayColors.edgeStroke
      );
    }
    return map;
  }, [visible.edges, effectiveLabelKey, effectiveColorKey, displayColors.edgeStroke]);

  // Resolve keys when options shrink (filters / hide), and leave the
  // single-color sentinels when the user has not chosen a legend property.
  useEffect(() => {
    if (simpleMode) return;
    const spread = resolveSpreadColorKeys({
      nodes: visible.nodes,
      edges: visible.edges,
      fillKey: appFillKey,
      borderKey: appBorderKey,
      textKey: appTextKey,
      strokeKey: colorPropertyKey,
      fillChosen: fillChosenRef.current,
      borderChosen: borderChosenRef.current,
      textChosen: textChosenRef.current,
      strokeChosen: strokeChosenRef.current,
      colors: legendColorsRef.current,
    });
    const nextLabel = resolveMirroredLabelKey({
      storedKey: labelPropertyKey,
      strokeKey: spread.strokeKey,
      userChose: labelChosenRef.current,
      edges: visible.edges,
    });
    if (spread.strokeKey !== colorPropertyKey) {
      setColorPropertyKey(spread.strokeKey);
      storeColorPropertyKey(spread.strokeKey);
    }
    if (nextLabel !== labelPropertyKey) {
      setLabelPropertyKey(nextLabel);
      storeLabelPropertyKey(nextLabel);
    }
    if (spread.fillKey !== appFillKey) {
      setAppFillKey(spread.fillKey);
      storeAppFillKey(spread.fillKey);
    }
    if (spread.borderKey !== appBorderKey) {
      setAppBorderKey(spread.borderKey);
      storeAppBorderKey(spread.borderKey);
    }
    if (spread.textKey !== appTextKey) {
      setAppTextKey(spread.textKey);
      storeAppTextKey(spread.textKey);
    }
  }, [
    simpleMode,
    visible.edges,
    visible.nodes,
    colorPropertyKey,
    labelPropertyKey,
    appFillKey,
    appBorderKey,
    appTextKey,
  ]);

  const handleColorPropertyChange = useCallback((key: string) => {
    strokeChosenRef.current = true;
    storeStrokePropertyChosen();
    setColorPropertyKey(key);
    storeColorPropertyKey(key);
    if (!labelChosenRef.current) {
      setLabelPropertyKey(key);
      storeLabelPropertyKey(key);
    }
  }, []);
  const handleLabelPropertyChange = useCallback((key: string) => {
    labelChosenRef.current = true;
    storeLabelPropertyChosen();
    if (key === HIDE_EDGE_LABELS_KEY) {
      setHideEdgeLabels(true);
      storeHideEdgeLabels(true);
      return;
    }
    setHideEdgeLabels(false);
    storeHideEdgeLabels(false);
    setLabelPropertyKey(key);
    storeLabelPropertyKey(key);
  }, []);
  const handleAppFillChange = useCallback((key: string) => {
    fillChosenRef.current = true;
    storeFillPropertyChosen();
    setAppFillKey(key);
    storeAppFillKey(key);
    if (!borderChosenRef.current) {
      setAppBorderKey(key);
      storeAppBorderKey(key);
      if (!textChosenRef.current) {
        setAppTextKey(key);
        storeAppTextKey(key);
      }
    }
  }, []);
  const handleAppBorderChange = useCallback((key: string) => {
    borderChosenRef.current = true;
    storeBorderPropertyChosen();
    setAppBorderKey(key);
    storeAppBorderKey(key);
    if (!textChosenRef.current) {
      setAppTextKey(key);
      storeAppTextKey(key);
    }
  }, []);
  const handleAppTextChange = useCallback((key: string) => {
    textChosenRef.current = true;
    storeTextPropertyChosen();
    setAppTextKey(key);
    storeAppTextKey(key);
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

  const getLegendSnapshot = useCallback((): GraphLegendSnapshot => {
    return {
      edgeColorKey: effectiveColorKey,
      edgeLabelKey: effectiveLabelKey,
      appFillKey: effectiveFillKey,
      appBorderKey: effectiveBorderKey,
      appTextKey: effectiveTextKey,
      colors: legendColorsRef.current,
      hideEdgeLabels: hideEdgeLabelsRef.current,
    };
  }, [effectiveColorKey, effectiveLabelKey, effectiveFillKey, effectiveBorderKey, effectiveTextKey]);

  const applyLegendSnapshot = useCallback((legend: GraphLegendSnapshot | null | undefined) => {
    if (!legend) return;
    if (legend.edgeColorKey) {
      strokeChosenRef.current = true;
      storeStrokePropertyChosen();
      setColorPropertyKey(legend.edgeColorKey);
      storeColorPropertyKey(legend.edgeColorKey);
    }
    if (legend.edgeLabelKey) {
      labelChosenRef.current = true;
      storeLabelPropertyChosen();
      setLabelPropertyKey(legend.edgeLabelKey);
      storeLabelPropertyKey(legend.edgeLabelKey);
    }
    if (legend.appFillKey) {
      fillChosenRef.current = true;
      storeFillPropertyChosen();
      setAppFillKey(legend.appFillKey);
      storeAppFillKey(legend.appFillKey);
    }
    if (legend.appBorderKey) {
      borderChosenRef.current = true;
      storeBorderPropertyChosen();
      setAppBorderKey(legend.appBorderKey);
      storeAppBorderKey(legend.appBorderKey);
    }
    // Older saved legends have no text key: text follows the border attribute.
    const textKey = legend.appTextKey || legend.appBorderKey;
    if (textKey) {
      textChosenRef.current = true;
      storeTextPropertyChosen();
      setAppTextKey(textKey);
      storeAppTextKey(textKey);
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
    if (hide) {
      labelChosenRef.current = true;
      storeLabelPropertyChosen();
    }
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
            appTextKey: effectiveTextKey,
            colors: legendColorsRef.current,
            hideEdgeLabels: hideEdgeLabelsRef.current,
          },
        ];
        storeLegendSetups(next);
        return next;
      });
    },
    [effectiveColorKey, effectiveLabelKey, effectiveFillKey, effectiveBorderKey, effectiveTextKey]
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
      const colors = displayColors;
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
  }, [effectiveColorKey, effectiveLabelKey, displayColors, hideEdgeLabels, status, setEdges]);

  useEffect(() => {
    if (status !== 'ready') return;
    setNodes((prev) => {
      if (prev.length === 0) return prev;
      return applyNodeCoding(prev, graphNodesRef.current, {
        appFillKey: effectiveFillKey,
        appBorderKey: effectiveBorderKey,
        appTextKey: effectiveTextKey,
        colors: displayColors,
      });
    });
  }, [effectiveFillKey, effectiveBorderKey, effectiveTextKey, displayColors, status, setNodes]);

  useEffect(() => {
    if (status !== 'ready' || layoutRevision === 0) return;
    fitGraphView(rfRef.current);
  }, [status, layoutRevision, rfRef]);

  useEffect(() => {
    let isCancelled = false;

    (async () => {
      try {
        setStatus('loading');
        setMessage(null);
        if (matchNothing) {
          if (isCancelled) return;
          setGraphNodes([]);
          setGraphEdges([]);
          setNodes([]);
          setEdges([]);
          setStatus('ready');
          setMessage('No applications match these filters. Change criteria or reset.');
          return;
        }
        const data = await fetchGraph({
          applicationIds: applicationIds.length > 0 ? applicationIds : undefined,
          nodeAttributes: Object.keys(nodeAttributes).length > 0 ? nodeAttributes : undefined,
          nodeRefs: Object.keys(nodeRefs).length > 0 ? nodeRefs : undefined,
          edgeAttributes: Object.keys(edgeAttributes).length > 0 ? edgeAttributes : undefined,
        });
        if (isCancelled) return;

        setGraphNodes(data.nodes);
        setGraphEdges(data.edges);

        const simple = isSimpleLegendMode(data.nodes, data.edges);
        const spread = simple
          ? {
              strokeKey: RELATION_TYPE_COLOR_KEY,
              fillKey: NODE_TYPE_COLOR_KEY,
              borderKey: NODE_TYPE_COLOR_KEY,
              textKey: NODE_TYPE_COLOR_KEY,
            }
          : resolveSpreadColorKeys({
              nodes: data.nodes,
              edges: data.edges,
              fillKey: appFillKey,
              borderKey: appBorderKey,
              textKey: appTextKey,
              strokeKey: colorPropertyKey,
              fillChosen: fillChosenRef.current,
              borderChosen: borderChosenRef.current,
              textChosen: textChosenRef.current,
              strokeChosen: strokeChosenRef.current,
              colors: legendColorsRef.current,
            });
        const nextColor = spread.strokeKey;
        const nextLabel = simple
          ? RELATION_TYPE_COLOR_KEY
          : resolveMirroredLabelKey({
              storedKey: labelPropertyKey,
              strokeKey: nextColor,
              userChose: labelChosenRef.current,
              edges: data.edges,
            });
        const nextFill = spread.fillKey;
        const nextBorder = spread.borderKey;
        const nextText = spread.textKey;

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
        if (nextText !== appTextKey) {
          setAppTextKey(nextText);
          storeAppTextKey(nextText);
        }

        const colors = paintChannelColors({
          colors: legendColorsRef.current,
          fillKey: nextFill,
          fillValues: collectNodeLegendValues(data.nodes, nextFill),
          borderKey: nextBorder,
          textKey: nextText,
          textValues: collectNodeLegendValues(data.nodes, nextText),
          strokeKey: nextColor,
          strokeValues: collectLegendColorValues(
            edgeIds.length > 0 ? data.edges.filter((edge) => edgeIds.includes(edge.id)) : data.edges,
            nextColor
          ),
        });
        const typeById = new Map(data.nodes.map((n) => [n.id, n.type]));
        const nodeCoding: NodeCodingKeys = {
          appFillKey: nextFill,
          appBorderKey: nextBorder,
          appTextKey: nextText,
          colors,
        };
        const baseNodes = data.nodes.map((n) => buildAppNode(n, nodeCoding));
        const shownEdges =
          edgeIds.length > 0 ? data.edges.filter((edge) => edgeIds.includes(edge.id)) : data.edges;
        const builtEdges = shownEdges.map((e) =>
          buildAppEdge(e, typeById, nextColor, nextLabel, colors, hideEdgeLabelsRef.current)
        );
        const rect = containerRef.current?.getBoundingClientRect();
        const aspectRatio = rect && rect.height > 0 ? rect.width / rect.height : 16 / 9;

        try {
          const { nodes: laidOut, routes } = await placeApplicationGraph(baseNodes, builtEdges, {
            nodeWidth: NODE_WIDTH,
            nodeHeight: NODE_HEIGHT,
            nodeSeparation: 70,
            layerSeparation: 100,
            aspectRatio,
          });
          if (isCancelled) return;
          const separated = spreadStackedRoutes(routes);
          const jumps = computeBridges(separated);
          setNodes(laidOut);
          setEdges(builtEdges.map((e) => attachRoute(e, separated.get(e.id), jumps.get(e.id))));
        } catch {
          if (isCancelled) return;
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

        if (!isCancelled) setLayoutRevision((v) => v + 1);

        setStatus('ready');
        if (pendingSandboxFilterHint) {
          setMessage('Filters applied — sandbox draft reset.');
          setPendingSandboxFilterHint(false);
        } else if (data.nodes.length === 0) {
          setMessage(
            filtersActive
              ? 'No applications match these filters. Change criteria or reset.'
              : 'No nodes. Start the backend with Neo4j to load demo data.',
          );
        } else {
          setMessage(null);
        }
      } catch (e) {
        if (!isCancelled) {
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
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally re-fetch only on filters / reload nonce
  }, [
    applicationIds,
    nodeAttributes,
    nodeRefs,
    edgeAttributes,
    edgeIds,
    matchNothing,
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
    appTextKey: effectiveTextKey,
    displayColors,
    hideEdgeLabels,
    handleColorPropertyChange,
    handleLabelPropertyChange,
    handleAppFillChange,
    handleAppBorderChange,
    handleAppTextChange,
    handleValueColorChange,
    getLegendSnapshot,
    applyLegendSnapshot,
    legendColorPropertyOptions,
    legendLabelPropertyOptions,
    legendAppPropertyOptions,
    legendColorValues,
    legendLabelValues,
    legendLabelStrokeColors,
    legendFillValues,
    legendBorderValues,
    legendTextValues,
    legendSetups,
    saveLegendSetup,
    applyLegendSetup,
    deleteLegendSetup,
  };
}

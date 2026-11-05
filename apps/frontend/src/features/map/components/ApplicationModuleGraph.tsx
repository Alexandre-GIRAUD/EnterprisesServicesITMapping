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
import type { GraphResponseDto } from '@/types/api';
import { fetchModuleGraph } from '../api/graphApi';
import {
  applicationModelFromNode,
  moduleDetailsFromNode,
  moduleLinksFromEdges,
  type ApplicationModel,
  type ModuleDetails,
  type ModuleLink,
} from '../utils/moduleDetails';
import { ApplicationModulesDrawer } from './ApplicationModulesDrawer';
import { ModuleGraphNode, type ModuleNode } from './ModuleGraphNode';
import { NODE_TYPE_STYLES, type NodeTypeKey } from './graphTheme';
import { GraphLegend } from './GraphLegend';
import { fitGraphView } from './fitGraphView';
import { CenterGraphControl } from './CenterGraphControl';
import { FullscreenControl } from './FullscreenControl';
import { FULLSCREEN_REFIT_DELAY_MS, useFullscreen } from './fullscreen';
import { MODULE_DRAWER_WIDTH_PX, computeDrawerFitPadding } from './drawerFitPadding';
import { computeModuleTiers, type ModuleTier } from './moduleFocus';
import { buildModuleNestedNodes, type ModuleTree } from './moduleNestedLayout';
import { tierClassName, type FocusTier } from './graphFocus';

const KNOWN_NODE_TYPES = Object.keys(NODE_TYPE_STYLES) as NodeTypeKey[];
const GRID = 16;
/** The drawer is resized by hand: refit once it has stopped moving. */
const REFIT_DEBOUNCE_MS = 200;
const CENTER_ANIMATION_MS = 200;

type Props = {
  applicationId: string;
  applicationName?: string;
  /** Past day shown: the drawer only reads. */
  isReadOnly?: boolean;
};

type DrawerModule = ModuleDetails & { colorSlot: number | null };

/** The module tiers map onto the main graph's: an enclosing box keeps its normal look. */
function toFocusTier(tier: ModuleTier | undefined): FocusTier | null {
  if (!tier || tier === 'context') return null;
  return tier;
}

const EMPTY_MODEL: ApplicationModel = { businessObjects: [], mainJourney: '', scope: '' };

/**
 * Module composition view (GET …/module-graph) as nested boxes inside the
 * application container. CONTAINS edges drive hierarchy only — nothing is drawn.
 */
export function ApplicationModuleGraph({
  applicationId,
  applicationName = '',
  isReadOnly = false,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rfRef = useRef<ReactFlowInstance<ModuleNode, never> | null>(null);
  const treeRef = useRef<ModuleTree | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<ModuleNode>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  // The module open in the drawer keeps the highlight; otherwise the cursor decides.
  const focusedId = pinnedId ?? hoveredId;
  const [legendNodeTypes, setLegendNodeTypes] = useState<NodeTypeKey[]>([]);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const [drawerModules, setDrawerModules] = useState<DrawerModule[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [drawerWidth, setDrawerWidth] = useState(MODULE_DRAWER_WIDTH_PX);
  const [debouncedDrawerWidth, setDebouncedDrawerWidth] = useState(MODULE_DRAWER_WIDTH_PX);
  const [concealSignal, setConcealSignal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [applicationDescription, setApplicationDescription] = useState('');
  const [applicationModel, setApplicationModel] = useState<ApplicationModel>(EMPTY_MODEL);
  const [moduleLinks, setModuleLinks] = useState<ModuleLink[]>([]);

  const nodeTypes = useMemo<NodeTypes>(() => ({ module: ModuleGraphNode }), []);

  const tiers = useMemo(() => {
    if (!focusedId || !treeRef.current) return null;
    return computeModuleTiers({
      focusId: focusedId,
      nodeIds: nodes.map((n) => n.id),
      childrenByParent: treeRef.current.childrenByParent,
      links: moduleLinks,
    });
  }, [focusedId, nodes, moduleLinks]);

  const displayNodes = useMemo(() => {
    if (!tiers) return nodes;
    return nodes.map((n) => ({ ...n, className: tierClassName(toFocusTier(tiers.get(n.id))) }));
  }, [nodes, tiers]);

  // The module open in the drawer and its neighbors; undefined fits the whole graph.
  const fitNodeIds = useMemo(() => {
    if (!isDrawerOpen || !pinnedId || !treeRef.current || pinnedId === treeRef.current.rootId) return undefined;
    const pinnedTiers = computeModuleTiers({
      focusId: pinnedId,
      nodeIds: [...treeRef.current.nodeMeta.keys()],
      childrenByParent: treeRef.current.childrenByParent,
      links: moduleLinks,
    });
    return [...pinnedTiers].filter(([, tier]) => tier === 'self' || tier === 'neighbor').map(([id]) => id);
  }, [isDrawerOpen, pinnedId, moduleLinks]);
  const fitNodeKey = fitNodeIds?.join('|');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedDrawerWidth(drawerWidth), REFIT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [drawerWidth]);

  const [fullscreenRevision, setFullscreenRevision] = useState(0);
  const refitAfterFullscreen = useCallback(() => {
    window.setTimeout(() => setFullscreenRevision((v) => v + 1), FULLSCREEN_REFIT_DELAY_MS);
  }, []);
  const fullscreen = useFullscreen(wrapRef, refitAfterFullscreen);

  const fitModules = (duration?: number) =>
    fitGraphView(rfRef.current, {
      duration,
      padding: computeDrawerFitPadding(isDrawerOpen, {
        paneWidthPx: containerRef.current?.clientWidth,
        drawerWidthPx: debouncedDrawerWidth,
      }),
      nodeIds: fitNodeIds,
    });

  useEffect(() => {
    if (status !== 'ready' || nodes.length === 0 || layoutRevision === 0) return;
    fitModules();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fitNodeKey stands for fitNodeIds
  }, [status, nodes.length, layoutRevision, isDrawerOpen, debouncedDrawerWidth, fitNodeKey, fullscreenRevision]);

  const applyGraph = useCallback(
    (data: GraphResponseDto) => {
      const { rfNodes, tree } = buildModuleNestedNodes(data.nodes, data.edges);
      treeRef.current = tree;

      const presentNodeTypes = new Set(data.nodes.map((n) => n.type));
      setLegendNodeTypes(KNOWN_NODE_TYPES.filter((t) => presentNodeTypes.has(t)));

      const slotById = new Map(rfNodes.map((n) => [n.id, n.data.colorSlot]));
      setDrawerModules(
        data.nodes
          .filter((n) => n.type !== 'Application')
          .map((n) => ({ ...moduleDetailsFromNode(n), colorSlot: slotById.get(n.id) ?? null }))
      );

      const applicationNode = data.nodes.find((n) => n.type === 'Application');
      setApplicationDescription(applicationNode?.description?.trim() ?? '');
      setApplicationModel(applicationNode ? applicationModelFromNode(applicationNode) : EMPTY_MODEL);
      setModuleLinks(moduleLinksFromEdges(data.edges));
      setNodes(rfNodes);
      setLayoutRevision((v) => v + 1);
    },
    [setNodes]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setStatus('loading');
      setMessage(null);
      try {
        const data = await fetchModuleGraph(applicationId);
        if (cancelled) return;

        applyGraph(data);

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
          setDrawerModules([]);
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
  }, [applicationId, applyGraph, reloadKey, setNodes]);

  const handleNodeMouseEnter = useCallback(
    (_: ReactMouseEvent, node: ModuleNode) => setHoveredId(node.id),
    []
  );

  const handleNodeMouseLeave = useCallback(() => {
    setHoveredId(null);
  }, []);

  const handleNodeClick = useCallback((_: ReactMouseEvent, node: ModuleNode) => {
    setPinnedId(node.id);
    setIsDrawerOpen(true);
    setConcealSignal((signal) => signal + 1);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setIsDrawerOpen(false);
    setPinnedId(null);
  }, []);

  const hintText = status === 'ready' ? message : null;

  return (
    <div ref={wrapRef} className="graph-canvas-wrap module-graph-wrap">
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
        <p className="graph-canvas-hint module-graph-hint">
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
          nodesDraggable
          nodesConnectable={false}
          snapToGrid
          snapGrid={[GRID, GRID]}
          minZoom={0.05}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#e2e8f0" gap={GRID} />
          <Controls showInteractive={false} showFitView={false}>
            <CenterGraphControl onCenter={() => fitModules(CENTER_ANIMATION_MS)} />
            <FullscreenControl isFullscreen={fullscreen.isFullscreen} onToggle={fullscreen.toggle} />
          </Controls>
          {!isDrawerOpen && (
            <Panel position="top-right">
              <button
                type="button"
                className="graph-drawer-action"
                onClick={() => setIsDrawerOpen(true)}
              >
                <span className="graph-drawer-action-title">Module details</span>
              </button>
            </Panel>
          )}
          {legendNodeTypes.length > 0 && (
            <Panel position="top-left">
              <GraphLegend nodeTypes={legendNodeTypes} concealSignal={concealSignal} />
            </Panel>
          )}
        </ReactFlow>
      </div>
      <ApplicationModulesDrawer
        isOpen={isDrawerOpen && status === 'ready'}
        applicationId={applicationId}
        applicationName={applicationName}
        applicationDescription={applicationDescription}
        applicationModel={applicationModel}
        links={moduleLinks}
        modules={drawerModules}
        selectedId={pinnedId}
        onSelect={setPinnedId}
        onClose={handleDrawerClose}
        width={drawerWidth}
        onWidthChange={setDrawerWidth}
        onSaved={() => setReloadKey((k) => k + 1)}
        isReadOnly={isReadOnly}
      />
    </div>
  );
}

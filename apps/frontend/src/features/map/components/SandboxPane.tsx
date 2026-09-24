import {
  Background,
  Controls,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeTypes,
  type OnEdgesChange,
  type OnNodesChange,
} from '@xyflow/react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { GRID } from '../hooks/useGraphData';
import { AppGraphNode } from './AppGraphNode';
import { HiddenAppsPicker } from './HiddenAppsPicker';
import { OrientedEdge } from './OrientedEdge';
import { SandboxIconNode } from './SandboxIconNode';
import { SandboxTextNode } from './SandboxTextNode';
import {
  sandboxFilterVisibleIds,
  sandboxIconLabel,
  type SandboxDocument,
  type SandboxIcon,
  type SandboxTextBox,
} from '../utils/sandboxDocuments';
import { SandboxIconGlyph } from './SandboxIconGlyph';

type Props = {
  doc: SandboxDocument;
  active: boolean;
  toast?: string | null;
  onActivate: () => void;
  onNodesChange: OnNodesChange<Node>;
  onEdgesChange: OnEdgesChange<Edge>;
  onDocNodes: (nodes: Node[]) => void;
  onDocEdges: (edges: Edge[]) => void;
  onSave: () => void;
  onClose: () => void;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onNewSandbox: () => void;
  onAddNode: () => void;
  onAddEdge: () => void;
  recentIcons: string[];
  onPickRecentIcon: (iconKey: string) => void;
  onNodeDisplayLabel: (nodeId: string, label: string) => void;
  onEdgeDisplayLabel: (edgeId: string, label: string) => void;
  onIconMove: (iconId: string, x: number, y: number) => void;
  onIconDelete: (iconId: string) => void;
  onTextMove: (textId: string, x: number, y: number) => void;
  onTextChange: (
    textId: string,
    patch: Partial<Pick<SandboxTextBox, 'text' | 'width' | 'fontSize' | 'align'>>
  ) => void;
  onTextDelete: (textId: string) => void;
  onHideNode: (nodeId: string) => void;
  onShowHidden: (ids: string[]) => void;
  onOpenDetails: (nodeId: string, label: string) => void;
  onOpenEdgeDetails: (edgeId: string) => void;
  onClearDetails?: () => void;
  onOpenModules: (nodeId: string, label: string) => void;
  /** When set, pane click places this icon at flow coords. */
  placingIconKey?: string | null;
  onPlaceIcon?: (x: number, y: number) => void;
  /** When true, pane click places a text box. */
  placingText?: boolean;
  onPlaceText?: (x: number, y: number) => void;
  /** Text box id that should open in edit mode once (after place). */
  editingTextId?: string | null;
  onTextEditStarted?: (textId: string) => void;
};

function iconNodesFromDoc(icons: SandboxIcon[], onDelete: (id: string) => void): Node[] {
  return icons.map((icon) => ({
    id: icon.id,
    type: 'sandboxIcon',
    position: { x: icon.x, y: icon.y },
    data: {
      iconKey: icon.iconKey,
      legendLabel: icon.legendLabel,
      onDelete: () => onDelete(icon.id),
    },
    draggable: true,
    selectable: true,
  }));
}

function textNodesFromDoc(
  boxes: SandboxTextBox[],
  handlers: {
    onDelete: (id: string) => void;
    onChange: Props['onTextChange'];
    editingTextId?: string | null;
    onTextEditStarted?: (textId: string) => void;
  }
): Node[] {
  return boxes.map((box) => ({
    id: box.id,
    type: 'sandboxText',
    position: { x: box.x, y: box.y },
    data: {
      text: box.text,
      fontSize: box.fontSize,
      align: box.align,
      width: box.width,
      onDelete: () => handlers.onDelete(box.id),
      onChangeText: (text: string) => handlers.onChange(box.id, { text }),
      onChangeFontSize: (fontSize: SandboxTextBox['fontSize']) =>
        handlers.onChange(box.id, { fontSize }),
      onChangeAlign: (align: SandboxTextBox['align']) => handlers.onChange(box.id, { align }),
      onChangeWidth: (width: number) => handlers.onChange(box.id, { width }),
      startEditing: handlers.editingTextId === box.id,
      onStartedEditing: () => handlers.onTextEditStarted?.(box.id),
    },
    draggable: true,
    selectable: true,
  }));
}

function isAnnotationNode(node: Node): boolean {
  return node.type === 'sandboxIcon' || node.type === 'sandboxText';
}

function SandboxPaneInner({
  doc,
  active,
  toast,
  onActivate,
  onNodesChange,
  onEdgesChange,
  onDocNodes,
  onDocEdges,
  onSave,
  onClose,
  onRename,
  onDuplicate,
  onNewSandbox,
  onAddNode,
  onAddEdge,
  recentIcons,
  onPickRecentIcon,
  onNodeDisplayLabel,
  onEdgeDisplayLabel,
  onIconMove,
  onIconDelete,
  onTextMove,
  onTextChange,
  onTextDelete,
  onHideNode,
  onShowHidden,
  onOpenDetails,
  onOpenEdgeDetails,
  onClearDetails,
  onOpenModules,
  placingIconKey,
  onPlaceIcon,
  placingText,
  onPlaceText,
  editingTextId,
  onTextEditStarted,
}: Props) {
  const { screenToFlowPosition } = useReactFlow();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(doc.name);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const lastNodeClickRef = useRef<{ nodeId: string; time: number } | null>(null);
  const nodeClickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const DOUBLE_CLICK_MS = 400;

  useEffect(() => {
    if (!editingTitle) setTitleDraft(doc.name);
  }, [doc.name, editingTitle]);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [ctxMenu]);

  const hiddenIds = doc.hiddenNodeIds ?? [];
  const hiddenSet = useMemo(() => new Set(hiddenIds), [hiddenIds]);
  const filterVisibleIds = useMemo(() => sandboxFilterVisibleIds(doc), [doc]);

  const appNodes = useMemo(
    () =>
      doc.nodes
        .filter(
          (n) =>
            !hiddenSet.has(n.id) && (!filterVisibleIds || filterVisibleIds.has(n.id))
        )
        .map((n) => ({
          ...n,
          data: {
            ...n.data,
            displayLabel: doc.nodeLabelOverrides[n.id] ?? n.data.displayLabel,
            onDisplayLabelChange: (label: string) => onNodeDisplayLabel(n.id, label),
            onHide:
              n.data.nodeType === 'Application' ? () => onHideNode(n.id) : undefined,
          },
        })),
    [
      doc.nodes,
      doc.nodeLabelOverrides,
      hiddenSet,
      filterVisibleIds,
      onNodeDisplayLabel,
      onHideNode,
    ]
  );
  const appEdges = useMemo(
    () =>
      doc.edges
        .filter(
          (e) =>
            !hiddenSet.has(e.source) &&
            !hiddenSet.has(e.target) &&
            (!filterVisibleIds ||
              (filterVisibleIds.has(e.source) && filterVisibleIds.has(e.target)))
        )
        .map((e) => {
          const override = doc.edgeLabelOverrides[e.id];
          const text =
            override !== undefined ? override : String(e.label ?? e.data?.dataLabel ?? '');
          return {
            ...e,
            label: text,
            data: {
              ...e.data!,
              labelColor: e.data?.sourceColor ?? e.data?.labelColor,
              displayLabel: text,
              onDisplayLabelChange: (label: string) => onEdgeDisplayLabel(e.id, label),
              onSelect: e.data?.indirect ? undefined : () => onOpenEdgeDetails(e.id),
            },
          };
        }),
    [doc.edges, doc.edgeLabelOverrides, hiddenSet, filterVisibleIds, onEdgeDisplayLabel, onOpenEdgeDetails]
  );

  const hiddenOptions = useMemo(
    () =>
      hiddenIds.map((id) => {
        const node = doc.nodes.find((n) => n.id === id);
        const label =
          doc.nodeLabelOverrides[id] ?? node?.data.displayLabel ?? node?.data.label ?? id;
        return { id, label: String(label) };
      }),
    [hiddenIds, doc.nodes, doc.nodeLabelOverrides]
  );

  const mergedNodes = useMemo(
    () => [
      ...appNodes,
      ...iconNodesFromDoc(doc.icons, onIconDelete),
      ...textNodesFromDoc(doc.textBoxes ?? [], {
        onDelete: onTextDelete,
        onChange: onTextChange,
        editingTextId,
        onTextEditStarted,
      }),
    ],
    [
      appNodes,
      doc.icons,
      doc.textBoxes,
      onIconDelete,
      onTextDelete,
      onTextChange,
      editingTextId,
      onTextEditStarted,
    ]
  );

  const [nodes, setNodes, onNodesChangeLocal] = useNodesState(mergedNodes);
  const [edges, setEdges, onEdgesChangeLocal] = useEdgesState(appEdges);
  const displayEdges = useMemo(
    () =>
      edges.map((e) => ({
        ...e,
        className: [e.className, hoveredEdgeId === e.id ? 'is-hovered' : undefined]
          .filter(Boolean)
          .join(' '),
        data: {
          ...e.data,
          hovered: hoveredEdgeId === e.id && !e.data?.indirect,
        },
      })),
    [edges, hoveredEdgeId]
  );

  useEffect(() => {
    setNodes(mergedNodes);
  }, [mergedNodes, setNodes]);

  useEffect(() => {
    setEdges(appEdges);
  }, [appEdges, setEdges]);

  const nodeTypes = useMemo<NodeTypes>(
    () => ({ app: AppGraphNode, sandboxIcon: SandboxIconNode, sandboxText: SandboxTextNode }),
    []
  );
  const edgeTypes = useMemo<EdgeTypes>(() => ({ oriented: OrientedEdge }), []);

  function commitTitle() {
    setEditingTitle(false);
    const next = titleDraft.trim();
    if (next && next !== doc.name) onRename(next);
    else setTitleDraft(doc.name);
  }

  function onTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitTitle();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setEditingTitle(false);
      setTitleDraft(doc.name);
    }
  }

  function clearPendingNodeClick() {
    if (nodeClickTimeoutRef.current) {
      clearTimeout(nodeClickTimeoutRef.current);
      nodeClickTimeoutRef.current = null;
    }
  }

  function nodeLabel(node: Node): string {
    const data = node.data as { displayLabel?: string; label?: string };
    return String(data.displayLabel ?? data.label ?? node.id);
  }

  function placeAtClient(clientX: number, clientY: number) {
    if (placingText && onPlaceText) {
      const p = screenToFlowPosition({ x: clientX, y: clientY });
      onActivate();
      onPlaceText(p.x, p.y);
      return true;
    }
    if (!placingIconKey || !onPlaceIcon) return false;
    // Ghost is centered on the cursor; RF node position is top-left — offset by half icon size.
    const ICON_HALF = 16;
    const p = screenToFlowPosition({ x: clientX, y: clientY });
    onActivate();
    onPlaceIcon(p.x - ICON_HALF, p.y - ICON_HALF);
    return true;
  }

  function handlePaneClick(event: ReactMouseEvent) {
    if (placeAtClient(event.clientX, event.clientY)) return;
    setHoveredEdgeId(null);
    onClearDetails?.();
  }

  function handleNodeClick(event: ReactMouseEvent, node: Node) {
    if (placeAtClient(event.clientX, event.clientY)) return;
    if (String(node.id).startsWith('sandbox-icon-')) return;
    if (String(node.id).startsWith('sandbox-text-')) return;
    onActivate();

    const now = Date.now();
    const last = lastNodeClickRef.current;
    if (last && last.nodeId === node.id && now - last.time < DOUBLE_CLICK_MS) {
      lastNodeClickRef.current = null;
      clearPendingNodeClick();
      onOpenModules(node.id, nodeLabel(node));
      return;
    }
    lastNodeClickRef.current = { nodeId: node.id, time: now };

    if (event.detail >= 2) {
      lastNodeClickRef.current = null;
      clearPendingNodeClick();
      onOpenModules(node.id, nodeLabel(node));
      return;
    }

    clearPendingNodeClick();
    nodeClickTimeoutRef.current = setTimeout(() => {
      nodeClickTimeoutRef.current = null;
      if (lastNodeClickRef.current?.nodeId !== node.id) return;
      lastNodeClickRef.current = null;
      onOpenDetails(node.id, nodeLabel(node));
    }, 350);
  }

  function handleEdgeClick(_event: ReactMouseEvent, edge: Edge) {
    onActivate();
    const data = edge.data as { indirect?: boolean } | undefined;
    if (data?.indirect) return;
    onOpenEdgeDetails(edge.id);
  }

  function handleNodeDoubleClick(_event: ReactMouseEvent, node: Node) {
    if (placingIconKey || placingText) return;
    if (String(node.id).startsWith('sandbox-icon-')) return;
    if (String(node.id).startsWith('sandbox-text-')) return;
    clearPendingNodeClick();
    lastNodeClickRef.current = null;
    onOpenModules(node.id, nodeLabel(node));
  }

  const placing = Boolean(placingIconKey || placingText);

  return (
    <div
      className={`sandbox-pane${active ? ' is-active' : ''}${placing ? ' is-placing-icon' : ''}`}
      onMouseDown={onActivate}
      onContextMenu={(e) => {
        e.preventDefault();
        onActivate();
        setCtxMenu({ x: e.clientX, y: e.clientY });
      }}
      role="group"
      aria-label={doc.name}
    >
      <header className="sandbox-pane__header">
        {editingTitle ? (
          <input
            className="sandbox-pane__title-input"
            value={titleDraft}
            autoFocus
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={onTitleKeyDown}
            onClick={(e) => e.stopPropagation()}
            aria-label="Sandbox name"
          />
        ) : (
          <span
            className="sandbox-pane__title"
            title="Double-click to rename"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setTitleDraft(doc.name);
              setEditingTitle(true);
            }}
          >
            {doc.name}
            {doc.dirty ? ' •' : ''}
          </span>
        )}
        <button
          type="button"
          className="sandbox-pane__close"
          aria-label="Close sandbox"
          title="Close"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          ×
        </button>
      </header>
      {active && toast ? (
        <div className="sandbox-pane__toast" role="status">
          {toast}
        </div>
      ) : null}
      {ctxMenu ? (
        <div
          className="sandbox-pane__ctx"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="sandbox-pane__ctx-item"
            onClick={() => {
              setCtxMenu(null);
              onDuplicate();
            }}
          >
            Duplicate
          </button>
          <button
            type="button"
            className="sandbox-pane__ctx-item"
            onClick={() => {
              setCtxMenu(null);
              setTitleDraft(doc.name);
              setEditingTitle(true);
            }}
          >
            Rename
          </button>
          <button
            type="button"
            className="sandbox-pane__ctx-item"
            onClick={() => {
              setCtxMenu(null);
              onSave();
            }}
          >
            Save
          </button>
          <button
            type="button"
            className="sandbox-pane__ctx-item"
            onClick={() => {
              setCtxMenu(null);
              onClose();
            }}
          >
            Close
          </button>
          <button
            type="button"
            className="sandbox-pane__ctx-item"
            onClick={() => {
              setCtxMenu(null);
              onNewSandbox();
            }}
          >
            New sandbox
          </button>
          <div className="sandbox-pane__ctx-sep" role="separator" />
          <button
            type="button"
            className="sandbox-pane__ctx-item"
            onClick={() => {
              setCtxMenu(null);
              onAddNode();
            }}
          >
            Add node
          </button>
          <button
            type="button"
            className="sandbox-pane__ctx-item"
            onClick={() => {
              setCtxMenu(null);
              onAddEdge();
            }}
          >
            Add edge
          </button>
          {recentIcons.length > 0 ? (
            <>
              <div className="sandbox-pane__ctx-sep" role="separator" />
              {recentIcons.map((iconKey) => (
                <button
                  key={iconKey}
                  type="button"
                  className="sandbox-pane__ctx-item sandbox-pane__ctx-item--icon"
                  onClick={() => {
                    setCtxMenu(null);
                    onPickRecentIcon(iconKey);
                  }}
                >
                  <SandboxIconGlyph iconKey={iconKey} />
                  <span>{sandboxIconLabel(iconKey)}</span>
                </button>
              ))}
            </>
          ) : null}
        </div>
      ) : null}
      <div className="sandbox-pane__canvas">
        <ReactFlow
          nodes={nodes}
          edges={displayEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={(changes) => {
            onNodesChangeLocal(changes);
            onNodesChange(changes);
          }}
          onEdgesChange={(changes) => {
            onEdgesChangeLocal(changes);
            onEdgesChange(changes);
          }}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onEdgeMouseEnter={(_e, edge) => setHoveredEdgeId(edge.id)}
          onEdgeMouseLeave={() => setHoveredEdgeId(null)}
          onNodeDoubleClick={handleNodeDoubleClick}
          onPaneClick={handlePaneClick}
          fitView
          onNodeDragStop={(_e, node) => {
            if (String(node.id).startsWith('sandbox-icon-')) {
              onIconMove(node.id, node.position.x, node.position.y);
              return;
            }
            if (String(node.id).startsWith('sandbox-text-')) {
              onTextMove(node.id, node.position.x, node.position.y);
              return;
            }
            setNodes((curr) => {
              onDocNodes(curr.filter((n) => !isAnnotationNode(n)));
              return curr;
            });
          }}
          onNodesDelete={(deleted) => {
            for (const n of deleted) {
              if (String(n.id).startsWith('sandbox-icon-')) onIconDelete(n.id);
              if (String(n.id).startsWith('sandbox-text-')) onTextDelete(n.id);
            }
            setNodes((curr) => {
              onDocNodes(curr.filter((n) => !isAnnotationNode(n)));
              return curr;
            });
          }}
          onEdgesDelete={() => {
            setEdges((curr) => {
              onDocEdges(curr);
              return curr;
            });
          }}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          edgesFocusable
          elevateEdgesOnSelect
          snapToGrid
          snapGrid={[GRID, GRID]}
          minZoom={0.05}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#e2e8f0" gap={GRID} />
          <Controls showInteractive={false} />
          {hiddenIds.length > 0 ? (
            <Panel position="top-right">
              <HiddenAppsPicker
                hiddenIds={hiddenIds}
                options={hiddenOptions}
                onShow={onShowHidden}
              />
            </Panel>
          ) : null}
          <Panel position="bottom-right">
            <button
              type="button"
              className="sandbox-pane__save"
              aria-label="Save sandbox"
              title="Save"
              onClick={(e) => {
                e.stopPropagation();
                onSave();
              }}
            >
              ✓
            </button>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}

/** One independent sandbox React Flow surface. */
export function SandboxPane(props: Props) {
  return (
    <ReactFlowProvider>
      <SandboxPaneInner {...props} />
    </ReactFlowProvider>
  );
}

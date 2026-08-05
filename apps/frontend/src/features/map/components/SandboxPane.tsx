import {
  Background,
  Controls,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
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
import type { SandboxDocument, SandboxIcon } from '../utils/sandboxDocuments';

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
  onNodeDisplayLabel: (nodeId: string, label: string) => void;
  onEdgeDisplayLabel: (edgeId: string, label: string) => void;
  onIconMove: (iconId: string, x: number, y: number) => void;
  onIconDelete: (iconId: string) => void;
  onHideNode: (nodeId: string) => void;
  onShowHidden: (ids: string[]) => void;
  onOpenDetails: (nodeId: string, label: string) => void;
  onOpenModules: (nodeId: string, label: string) => void;
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
  onNodeDisplayLabel,
  onEdgeDisplayLabel,
  onIconMove,
  onIconDelete,
  onHideNode,
  onShowHidden,
  onOpenDetails,
  onOpenModules,
}: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(doc.name);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
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

  const appNodes = useMemo(
    () =>
      doc.nodes
        .filter((n) => !hiddenSet.has(n.id))
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
    [doc.nodes, doc.nodeLabelOverrides, hiddenSet, onNodeDisplayLabel, onHideNode]
  );
  const appEdges = useMemo(
    () =>
      doc.edges
        .filter((e) => !hiddenSet.has(e.source) && !hiddenSet.has(e.target))
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
            },
          };
        }),
    [doc.edges, doc.edgeLabelOverrides, hiddenSet, onEdgeDisplayLabel]
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
    () => [...appNodes, ...iconNodesFromDoc(doc.icons, onIconDelete)],
    [appNodes, doc.icons, onIconDelete]
  );

  const [nodes, setNodes, onNodesChangeLocal] = useNodesState(mergedNodes);
  const [edges, setEdges, onEdgesChangeLocal] = useEdgesState(appEdges);

  useEffect(() => {
    setNodes(mergedNodes);
  }, [mergedNodes, setNodes]);

  useEffect(() => {
    setEdges(appEdges);
  }, [appEdges, setEdges]);

  const nodeTypes = useMemo<NodeTypes>(
    () => ({ app: AppGraphNode, sandboxIcon: SandboxIconNode }),
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

  function handleNodeClick(event: ReactMouseEvent, node: Node) {
    if (String(node.id).startsWith('sandbox-icon-')) return;
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

  function handleNodeDoubleClick(_event: ReactMouseEvent, node: Node) {
    if (String(node.id).startsWith('sandbox-icon-')) return;
    clearPendingNodeClick();
    lastNodeClickRef.current = null;
    onOpenModules(node.id, nodeLabel(node));
  }

  return (
    <div
      className={`sandbox-pane${active ? ' is-active' : ''}`}
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
            Open new sandbox with same content
          </button>
        </div>
      ) : null}
      <div className="sandbox-pane__canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
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
          onNodeDoubleClick={handleNodeDoubleClick}
          fitView
          onNodeDragStop={(_e, node) => {
            if (String(node.id).startsWith('sandbox-icon-')) {
              onIconMove(node.id, node.position.x, node.position.y);
              return;
            }
            setNodes((curr) => {
              onDocNodes(curr.filter((n) => n.type !== 'sandboxIcon'));
              return curr;
            });
          }}
          onNodesDelete={() => {
            setNodes((curr) => {
              onDocNodes(curr.filter((n) => n.type !== 'sandboxIcon'));
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

import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { Handle, Position, useStore, type Node, type NodeProps } from '@xyflow/react';
import { ZOOM_THRESHOLDS, nodeColorForType } from './graphTheme';

export type AppGraphNodeData = {
  label: string;
  nodeType: string;
  /** Visual-only fill from legend (not a stored attribute). */
  fillColor?: string;
  /** Visual-only border from legend (not a stored attribute). */
  borderColor?: string;
  /** Collapse this application into an indirect flow (application graph only). */
  onHide?: () => void;
  /** Sandbox display-only label override (never written to Neo4j). */
  displayLabel?: string;
  /** When set, double-click edits the displayed label only. */
  onDisplayLabelChange?: (label: string) => void;
};

export type AppGraphNodeType = Node<AppGraphNodeData, 'app'>;

export function AppGraphNode({ data }: NodeProps<AppGraphNodeType>) {
  const zoom = useStore((s) => s.transform[2]);
  const borderColor = data.borderColor ?? nodeColorForType(data.nodeType);
  const fillColor = data.fillColor ?? '#ffffff';
  const labelVisible = zoom >= ZOOM_THRESHOLDS.primaryLabel;
  const shown = data.displayLabel ?? data.label;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(shown);

  function commit() {
    const next = draft.trim();
    setEditing(false);
    if (data.onDisplayLabelChange && next !== shown) {
      data.onDisplayLabelChange(next);
    }
  }

  function onDoubleClick(event: MouseEvent) {
    if (!data.onDisplayLabelChange) return;
    event.stopPropagation();
    setDraft(shown);
    setEditing(true);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setEditing(false);
      setDraft(shown);
    }
  }

  return (
    <div
      className="graph-node-card"
      style={{ borderColor, backgroundColor: fillColor }}
      onDoubleClick={onDoubleClick}
    >
      <Handle type="source" position={Position.Top} id="top-s" className="graph-node-handle" isConnectable={false} />
      <Handle type="target" position={Position.Top} id="top-t" className="graph-node-handle" isConnectable={false} />
      <Handle type="source" position={Position.Bottom} id="bottom-s" className="graph-node-handle" isConnectable={false} />
      <Handle type="target" position={Position.Bottom} id="bottom-t" className="graph-node-handle" isConnectable={false} />
      <Handle type="source" position={Position.Left} id="left-s" className="graph-node-handle" isConnectable={false} />
      <Handle type="target" position={Position.Left} id="left-t" className="graph-node-handle" isConnectable={false} />
      <Handle type="source" position={Position.Right} id="right-s" className="graph-node-handle" isConnectable={false} />
      <Handle type="target" position={Position.Right} id="right-t" className="graph-node-handle" isConnectable={false} />
      {data.onHide ? (
        <button
          type="button"
          className="graph-node-hide nodrag nopan"
          aria-label="Hide application"
          title="Hide application"
          onMouseDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
            data.onHide?.();
          }}
        >
          −
        </button>
      ) : null}
      {editing ? (
        <input
          className="graph-node-card__label-input nodrag nopan"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          onClick={(e) => e.stopPropagation()}
          aria-label="Edit display label"
        />
      ) : (
        <span
          className={`graph-node-card__label${labelVisible ? '' : ' is-hidden'}`}
          title={shown}
        >
          {shown}
        </span>
      )}
    </div>
  );
}

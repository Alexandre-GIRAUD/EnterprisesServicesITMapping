import { Handle, Position, useStore, type Node, type NodeProps } from '@xyflow/react';
import { ZOOM_THRESHOLDS, nodeColorForType } from './graphTheme';

export type AppGraphNodeData = {
  label: string;
  nodeType: string;
};

export type AppGraphNodeType = Node<AppGraphNodeData, 'app'>;

export function AppGraphNode({ data }: NodeProps<AppGraphNodeType>) {
  const zoom = useStore((s) => s.transform[2]);
  const color = nodeColorForType(data.nodeType);
  const labelVisible = zoom >= ZOOM_THRESHOLDS.primaryLabel;

  return (
    <div className="graph-node-card" style={{ borderColor: color }}>
      {/* 4-side handle pairs: both source and target at every position so React
          Flow can correctly resolve handle coords regardless of which side ELK
          or bestSides() chose for a given edge. isConnectable=false: read-only. */}
      <Handle type="source" position={Position.Top}    id="top-s"    className="graph-node-handle" isConnectable={false} />
      <Handle type="target" position={Position.Top}    id="top-t"    className="graph-node-handle" isConnectable={false} />
      <Handle type="source" position={Position.Bottom} id="bottom-s" className="graph-node-handle" isConnectable={false} />
      <Handle type="target" position={Position.Bottom} id="bottom-t" className="graph-node-handle" isConnectable={false} />
      <Handle type="source" position={Position.Left}   id="left-s"   className="graph-node-handle" isConnectable={false} />
      <Handle type="target" position={Position.Left}   id="left-t"   className="graph-node-handle" isConnectable={false} />
      <Handle type="source" position={Position.Right}  id="right-s"  className="graph-node-handle" isConnectable={false} />
      <Handle type="target" position={Position.Right}  id="right-t"  className="graph-node-handle" isConnectable={false} />
      <span
        className={`graph-node-card__label${labelVisible ? '' : ' is-hidden'}`}
        title={data.label}
      >
        {data.label}
      </span>
    </div>
  );
}

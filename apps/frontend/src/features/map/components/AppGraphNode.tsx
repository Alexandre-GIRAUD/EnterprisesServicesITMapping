import { Handle, Position, useStore, type Node, type NodeProps } from '@xyflow/react';
import { ZOOM_THRESHOLDS, nodeColorForType } from './graphTheme';

export type AppGraphNodeData = {
  label: string;
  nodeType: string;
};

export type AppGraphNodeType = Node<AppGraphNodeData, 'app'>;

/**
 * Application graph node: fixed-width card with center-edge handles (top =
 * target, bottom = source) so orthogonal edges anchor at bounding-box edge
 * centers. The label fades out below the primary semantic-zoom threshold to
 * keep a screen-filling overview readable.
 */
export function AppGraphNode({ data }: NodeProps<AppGraphNodeType>) {
  const zoom = useStore((s) => s.transform[2]);
  const color = nodeColorForType(data.nodeType);
  const labelVisible = zoom >= ZOOM_THRESHOLDS.primaryLabel;

  return (
    <div className="graph-node-card" style={{ borderColor: color }}>
      <Handle type="target" position={Position.Top} className="graph-node-handle" />
      <span
        className={`graph-node-card__label${labelVisible ? '' : ' is-hidden'}`}
        title={data.label}
      >
        {data.label}
      </span>
      <Handle type="source" position={Position.Bottom} className="graph-node-handle" />
    </div>
  );
}

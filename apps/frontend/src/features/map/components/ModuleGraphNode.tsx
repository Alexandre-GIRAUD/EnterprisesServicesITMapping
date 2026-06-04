import { Handle, Position, useStore, type NodeProps, type Node } from '@xyflow/react';
import { isTitleClamped } from './moduleNodeCardHtml';
import { ZOOM_THRESHOLDS } from './graphTheme';

export type ModuleNodeData = {
  name: string;
  description: string;
  nodeType: string;
};

export type ModuleNode = Node<ModuleNodeData, 'module'>;

export function ModuleGraphNode({ data }: NodeProps<ModuleNode>) {
  const zoom = useStore((s) => s.transform[2]);
  const rawName = data.name.trim() || '—';
  const description = data.description?.trim() ?? '';
  const hasDescription = description.length > 0;
  const isApp = data.nodeType === 'Application';
  const cardClass = isApp
    ? 'module-node-card module-node-card--application'
    : 'module-node-card';
  const titleAttr = isTitleClamped(rawName) ? rawName : undefined;
  const titleVisible = zoom >= ZOOM_THRESHOLDS.primaryLabel;
  const detailVisible = zoom >= ZOOM_THRESHOLDS.secondaryDetail;

  return (
    <div className={cardClass} title={titleAttr}>
      {/* 4-side handle pairs so any side can serve as source or target. */}
      <Handle type="source" position={Position.Top}    id="top-s"    className="module-node-handle" isConnectable={false} />
      <Handle type="target" position={Position.Top}    id="top-t"    className="module-node-handle" isConnectable={false} />
      <Handle type="source" position={Position.Bottom} id="bottom-s" className="module-node-handle" isConnectable={false} />
      <Handle type="target" position={Position.Bottom} id="bottom-t" className="module-node-handle" isConnectable={false} />
      <Handle type="source" position={Position.Left}   id="left-s"   className="module-node-handle" isConnectable={false} />
      <Handle type="target" position={Position.Left}   id="left-t"   className="module-node-handle" isConnectable={false} />
      <Handle type="source" position={Position.Right}  id="right-s"  className="module-node-handle" isConnectable={false} />
      <Handle type="target" position={Position.Right}  id="right-t"  className="module-node-handle" isConnectable={false} />
      <div className={`module-node-card__title${titleVisible ? '' : ' is-hidden'}`}>
        {rawName}
      </div>
      {hasDescription && (
        <>
          <hr className="module-node-card__divider" aria-hidden="true" />
          <p className={`module-node-card__description${detailVisible ? '' : ' is-hidden'}`}>
            {description}
          </p>
        </>
      )}
    </div>
  );
}

import { Handle, Position, useStore, type NodeProps, type Node } from '@xyflow/react';
import { isTitleClamped } from './moduleNodeCardHtml';
import { ZOOM_THRESHOLDS } from './graphTheme';

export type ModuleNodeData = {
  name: string;
  description: string;
  nodeType: string;
};

export type ModuleNode = Node<ModuleNodeData, 'module'>;

/**
 * Custom React Flow node rendering the module card (title + optional divider +
 * description). Replaces the previous cytoscape-node-html-label template while
 * reusing the same `.module-node-card` CSS classes and title-clamp heuristic.
 */
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
      <Handle type="target" position={Position.Top} className="module-node-handle" />
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
      <Handle type="source" position={Position.Bottom} className="module-node-handle" />
    </div>
  );
}

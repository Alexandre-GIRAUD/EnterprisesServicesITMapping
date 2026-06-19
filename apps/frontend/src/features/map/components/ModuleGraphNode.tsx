import { useStore, type NodeProps, type Node } from '@xyflow/react';
import { isTitleClamped } from './moduleNodeCardHtml';
import { ZOOM_THRESHOLDS } from './graphTheme';

export type ModuleNodeData = {
  name: string;
  description: string;
  nodeType: string;
  isContainer: boolean;
  depth: number;
};

export type ModuleNode = Node<ModuleNodeData, 'module'>;

export function ModuleGraphNode({ data }: NodeProps<ModuleNode>) {
  const zoom = useStore((s) => s.transform[2]);
  const rawName = data.name.trim() || '—';
  const description = data.description?.trim() ?? '';
  const hasDescription = description.length > 0;
  const isApp = data.nodeType === 'Application';
  const isContainer = data.isContainer;
  const titleAttr = isTitleClamped(rawName) ? rawName : undefined;
  const titleVisible = zoom >= ZOOM_THRESHOLDS.primaryLabel;
  const detailVisible = zoom >= ZOOM_THRESHOLDS.secondaryDetail;

  if (isContainer) {
    const cardClass = isApp
      ? 'module-node-card module-node-card--application module-node-card--container'
      : `module-node-card module-node-card--container module-node-card--container-nested`;
    return (
      <div className={cardClass} data-depth={data.depth} title={titleAttr}>
        <div className={`module-node-card__header${titleVisible ? '' : ' is-hidden'}`}>
          {rawName}
        </div>
        <div className="module-node-card__body" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="module-node-card" title={titleAttr}>
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

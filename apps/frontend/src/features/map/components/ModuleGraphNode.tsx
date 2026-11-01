import type { NodeProps, Node } from '@xyflow/react';
import type { CSSProperties } from 'react';
import { moduleTone } from './graphTheme';

export type ModuleNodeData = {
  name: string;
  description: string;
  nodeType: string;
  isContainer: boolean;
  depth: number;
  /** Palette slot of the module's data-link group; null draws it neutral. */
  colorSlot: number | null;
};

export type ModuleNode = Node<ModuleNodeData, 'module'>;

export function ModuleGraphNode({ data }: NodeProps<ModuleNode>) {
  const rawName = data.name.trim() || '—';
  const description = data.description?.trim() ?? '';
  const isApp = data.nodeType === 'Application';
  const isContainer = data.isContainer;
  const tone = moduleTone(data.colorSlot);
  const toneStyle = (isApp ? {} : { '--module-fill': tone.fill, '--module-border': tone.border }) as CSSProperties;

  if (isContainer) {
    const cardClass = isApp
      ? 'module-node-card module-node-card--application module-node-card--container'
      : `module-node-card module-node-card--container module-node-card--container-nested`;
    return (
      <div className={cardClass} data-depth={data.depth} style={toneStyle}>
        <div className="module-node-card__header">
          {rawName}
          {description && <span className="module-node-card__tip" role="tooltip">{description}</span>}
        </div>
        <div className="module-node-card__body" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="module-node-card" style={toneStyle}>
      <div className="module-node-card__title">{rawName}</div>
      {description && (
        <span className="module-node-card__tip" role="tooltip">
          {description}
        </span>
      )}
    </div>
  );
}

import { type Node, type NodeProps } from '@xyflow/react';
import { SandboxIconGlyph } from './SandboxIconGlyph';

export type SandboxIconNodeData = {
  iconKey: string;
  legendLabel: string;
  onDelete?: () => void;
};

export type SandboxIconNodeType = Node<SandboxIconNodeData, 'sandboxIcon'>;

export function SandboxIconNode({ data }: NodeProps<SandboxIconNodeType>) {
  return (
    <div className="sandbox-icon-node" title={data.legendLabel}>
      <SandboxIconGlyph iconKey={data.iconKey} />
      {data.onDelete ? (
        <button
          type="button"
          className="sandbox-icon-node__delete nodrag nopan"
          aria-label="Remove icon"
          title="Remove icon"
          onClick={(e) => {
            e.stopPropagation();
            data.onDelete?.();
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

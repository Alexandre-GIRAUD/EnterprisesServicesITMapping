import { ControlButton, Controls } from '@xyflow/react';

type GraphFitControlsProps = {
  onFit: () => void;
};

export function GraphFitControls({ onFit }: GraphFitControlsProps) {
  return (
    <Controls showInteractive={false} showFitView={false}>
      <ControlButton onClick={onFit} title="Fit view" aria-label="Fit view">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
          <path
            d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </ControlButton>
    </Controls>
  );
}

import { ControlButton } from '@xyflow/react';

type Props = {
  onCenter: () => void;
};

/** Target icon in the zoom controls: brings the whole graph back into view. */
export function CenterGraphControl({ onCenter }: Props) {
  const label = 'Center on the graph';
  return (
    <ControlButton onClick={onCenter} title={label} aria-label={label}>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      </svg>
    </ControlButton>
  );
}

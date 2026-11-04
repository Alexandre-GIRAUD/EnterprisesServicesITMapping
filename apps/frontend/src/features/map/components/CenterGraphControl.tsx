import { ControlButton } from '@xyflow/react';

type Props = {
  onCenter: () => void;
};

/** Target icon in the zoom controls: brings the whole graph back into view. */
export function CenterGraphControl({ onCenter }: Props) {
  const label = 'Center on the graph';
  return (
    <ControlButton onClick={onCenter} title={label} aria-label={label}>
      <svg className="center-graph-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="6.5" fill="none" />
        <circle cx="12" cy="12" r="2" fill="none" />
        <path d="M12 1.75v3.25M12 19v3.25M1.75 12h3.25M19 12h3.25" fill="none" />
      </svg>
    </ControlButton>
  );
}

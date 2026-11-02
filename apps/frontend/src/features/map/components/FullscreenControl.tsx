import { ControlButton } from '@xyflow/react';

type Props = {
  isFullscreen: boolean;
  onToggle: () => void;
};

/** Sits in the React Flow zoom controls, which stay visible in full screen. */
export function FullscreenControl({ isFullscreen, onToggle }: Props) {
  const label = isFullscreen ? 'Exit full screen' : 'Full screen';
  return (
    <ControlButton onClick={onToggle} title={label} aria-label={label}>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {isFullscreen ? (
          <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
        ) : (
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        )}
      </svg>
    </ControlButton>
  );
}

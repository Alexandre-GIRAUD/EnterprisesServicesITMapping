import { FLAME_PATH } from '../flamePath';

const FLAME_SIZES = { badge: 12, inline: 14, heading: 16, feature: 22 } as const;
const FLAME_STROKE_WIDTH = 2;

export type FlameSize = keyof typeof FLAME_SIZES;

export function FlameIcon({ size = 'heading', title }: { size?: FlameSize; title?: string }) {
  const pixels = FLAME_SIZES[size];
  return (
    <svg
      className="breach-flame"
      viewBox="0 0 24 24"
      width={pixels}
      height={pixels}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      <path
        d={FLAME_PATH}
        fill="none"
        stroke="currentColor"
        strokeWidth={FLAME_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

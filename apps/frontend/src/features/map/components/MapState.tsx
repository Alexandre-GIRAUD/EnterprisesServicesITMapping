import type { ReactNode } from 'react';

export type MapStateKind = 'loading' | 'empty' | 'error' | 'info';

type MapStateProps = { kind: MapStateKind; className?: string; children?: ReactNode };

/** The one message every view shows while loading, when empty, on failure, or to tell something. */
export function MapState({ kind, className, children }: MapStateProps) {
  const classes = ['map-state', `map-state--${kind}`, className].filter(Boolean).join(' ');
  return (
    <p className={classes} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}

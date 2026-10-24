import { ViewportPortal } from '@xyflow/react';
import { componentZoneFrames } from './graphComponents';

type ZoneNode = {
  id: string;
  position: { x: number; y: number };
  width?: number | null;
  height?: number | null;
};

type ZoneEdge = { source: string; target: string };

type ComponentZoneOverlayProps = {
  nodes: readonly ZoneNode[];
  edges: readonly ZoneEdge[];
};

export function ComponentZoneOverlay({ nodes, edges }: ComponentZoneOverlayProps) {
  const frames = componentZoneFrames(nodes, edges);
  if (frames.length < 2) return null;

  return (
    <ViewportPortal>
      {frames.map((frame) => (
        <div
          key={`${frame.x}:${frame.y}:${frame.width}:${frame.height}`}
          className="component-zone-frame"
          style={{
            transform: `translate(${frame.x}px, ${frame.y}px)`,
            width: frame.width,
            height: frame.height,
          }}
        />
      ))}
    </ViewportPortal>
  );
}

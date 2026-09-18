type EdgeDetailsOpener = (edgeId: string) => void;

let opener: EdgeDetailsOpener | null = null;

/** GraphCanvas registers the drawer opener; OrientedEdge calls it by edge id. */
export function bindEdgeDetailsOpener(next: EdgeDetailsOpener | null): () => void {
  opener = next;
  return () => {
    if (opener === next) opener = null;
  };
}

export function notifyEdgeDetailsOpen(edgeId: string): void {
  opener?.(edgeId);
}

/** Rows of Production / Sandbox / My views shown in the side menu. */
export function visibleWorkspaceViews<T extends { mode: string }>(
  views: readonly T[],
  activeMode: string,
  pointerInside: boolean,
  closedUntilLeave: boolean,
): readonly T[] {
  if (pointerInside && !closedUntilLeave) return views;
  const active = views.filter((view) => view.mode === activeMode);
  return active.length > 0 ? active : views.slice(0, 1);
}

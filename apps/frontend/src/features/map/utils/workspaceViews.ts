const FIRST_VISIBLE_VIEW = 1;

/** Which Production / Sandbox / My views rows stay on screen. */
export function selectVisibleWorkspaceViews<T extends { mode: string }>(
  views: readonly T[],
  visibility: { activeMode: string; isPointerInside: boolean; isClosedUntilLeave: boolean },
): readonly T[] {
  if (visibility.isPointerInside && !visibility.isClosedUntilLeave) return views;
  const active = views.filter((view) => view.mode === visibility.activeMode);
  if (active.length > 0) return active;
  return views.slice(0, FIRST_VISIBLE_VIEW);
}

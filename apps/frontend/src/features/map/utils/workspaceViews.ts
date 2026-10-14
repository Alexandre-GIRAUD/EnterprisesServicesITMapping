/** Label that should look selected: the one under the pointer, otherwise the real mode. */
export function primaryWorkspaceMode(activeMode: string, hoveredMode: string | null): string {
  if (hoveredMode) return hoveredMode;
  return activeMode;
}

/** The selected module, or null when the selection is the application itself (or nothing). */
export function scopedModule<T extends { id: string }>(modules: T[], selectedId: string | null): T | null {
  return modules.find((module) => module.id === selectedId) ?? null;
}

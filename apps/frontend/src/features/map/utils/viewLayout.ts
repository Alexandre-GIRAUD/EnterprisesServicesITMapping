export const VIEW_LAYOUT_STORAGE_KEY = 'flowra.myViews.layout';

export type ViewLayout = 'list' | 'grid';

export function storedViewLayout(value: string | null): ViewLayout {
  return value === 'grid' ? 'grid' : 'list';
}

export function nextViewLayout(current: ViewLayout): ViewLayout {
  return current === 'list' ? 'grid' : 'list';
}

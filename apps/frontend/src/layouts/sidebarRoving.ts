type RovingKeyEvent = {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  target: EventTarget | null;
  preventDefault: () => void;
};

export function nextRovingIndex(currentIndex: number, itemCount: number, key: string): number | null {
  if (itemCount <= 0) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return itemCount - 1;
  if (key === 'ArrowDown') {
    if (currentIndex < 0) return 0;
    return Math.min(currentIndex + 1, itemCount - 1);
  }
  if (key === 'ArrowUp') {
    if (currentIndex < 0) return itemCount - 1;
    return Math.max(currentIndex - 1, 0);
  }
  return null;
}

export function nextMenuIndex(currentIndex: number, itemCount: number, key: string): number | null {
  if (itemCount <= 0) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return itemCount - 1;
  if (key === 'ArrowDown') return currentIndex < 0 ? 0 : (currentIndex + 1) % itemCount;
  if (key === 'ArrowUp') return currentIndex < 0 ? itemCount - 1 : (currentIndex - 1 + itemCount) % itemCount;
  if (key === 'Tab') return currentIndex < 0 ? 0 : (currentIndex + 1) % itemCount;
  if (key === 'Shift+Tab') return currentIndex < 0 ? itemCount - 1 : (currentIndex - 1 + itemCount) % itemCount;
  return null;
}

export function collectSidebarItems(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('[data-sidebar-item]')].filter(
    (item) => item.closest('[data-sidebar-menu]') == null,
  );
}

/** Buttons default to tabIndex 0, so more than one stop means the list is not primed yet. */
export function primeSidebarTabStops(root: HTMLElement): void {
  const items = collectSidebarItems(root);
  if (items.length === 0) return;
  const tabStops = items.filter((item) => item.tabIndex === 0);
  if (tabStops.length === 1) return;
  const chosen = tabStops[0] ?? items[0];
  items.forEach((item) => {
    item.tabIndex = item === chosen ? 0 : -1;
  });
}

export function rememberSidebarTabStop(target: EventTarget | null, root: HTMLElement): void {
  if (!(target instanceof Element) || target.closest('[data-sidebar-menu]')) return;
  const item = target.closest('[data-sidebar-item]');
  if (!(item instanceof HTMLElement) || !root.contains(item)) return;
  for (const candidate of collectSidebarItems(root)) {
    candidate.tabIndex = candidate === item ? 0 : -1;
  }
}

function focusSidebarItem(items: HTMLElement[], nextIndex: number): void {
  items.forEach((item, index) => {
    item.tabIndex = index === nextIndex ? 0 : -1;
  });
  items[nextIndex]?.focus({ focusVisible: true } as FocusOptions);
}

export function moveSidebarFocus(event: RovingKeyEvent, root: HTMLElement): void {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const target = event.target;
  if (!(target instanceof Element) || target.closest('[data-sidebar-menu]')) return;
  const items = collectSidebarItems(root);
  const currentItem = target.closest('[data-sidebar-item]');
  const currentIndex = currentItem instanceof HTMLElement ? items.indexOf(currentItem) : -1;
  const nextIndex = nextRovingIndex(currentIndex, items.length, event.key);
  if (nextIndex == null) return;
  event.preventDefault();
  if (items[nextIndex] === currentItem) return;
  focusSidebarItem(items, nextIndex);
}

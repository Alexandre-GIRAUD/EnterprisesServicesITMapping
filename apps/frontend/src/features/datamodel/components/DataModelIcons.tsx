const ICON_PATHS = {
  plus: 'M12 5v14M5 12h14',
  refresh: 'M20 11a8 8 0 0 0-14.9-3M4 5v3h3M4 13a8 8 0 0 0 14.9 3M20 19v-3h-3',
  cube: 'M12 3 4 7.5v9L12 21l8-4.5v-9L12 3zM4 7.5 12 12l8-4.5M12 12v9',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  sparkle: 'M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  filter: 'M4 5h16l-6 7.5V19l-4-2v-4.5L4 5z',
  chevronDown: 'm6 9 6 6 6-6',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  tag: 'M3 12V4h8l9 9-8 8-9-9zM7.5 8h.01',
  more: 'M12 5h.01M12 12h.01M12 19h.01',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  check: 'm5 12 5 5 9-10',
  alert: 'M12 8v5M12 16h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
} as const;

export type DataModelIconName = keyof typeof ICON_PATHS;

const DOT_ICONS = new Set<DataModelIconName>(['grip', 'more']);
const DEFAULT_ICON_SIZE = 16;

export function DataModelIcon({ name, size = DEFAULT_ICON_SIZE }: { name: DataModelIconName; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <path
        d={ICON_PATHS[name]}
        fill="none"
        stroke="currentColor"
        strokeWidth={DOT_ICONS.has(name) ? 3 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

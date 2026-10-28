const ICON_STROKE_WIDTH = 1.8;

type IconMark = {
  paths?: readonly string[];
  circles?: readonly { cx: number; cy: number; r: number }[];
};

const NAVIGATION_ICONS = {
  chat: {
    paths: ['M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-4 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z'],
  },
  cartography: {
    paths: ['M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4zM9 4v13M15 6.5v13'],
  },
  dataModel: {
    paths: [
      'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6',
    ],
  },
  sources: {
    paths: ['m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14'],
  },
  changes: {
    paths: ['M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2'],
  },
  settings: {
    paths: [
      'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
    ],
  },
  circleHelp: {
    circles: [{ cx: 12, cy: 12, r: 10 }],
    paths: ['M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3', 'M12 17h.01'],
  },
  logOut: {
    paths: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9'],
  },
  chevronDown: {
    paths: ['m6 9 6 6 6-6'],
  },
  sun: {
    circles: [{ cx: 12, cy: 12, r: 4 }],
    paths: [
      'M12 2v2',
      'M12 20v2',
      'm4.93 4.93 1.41 1.41',
      'm17.66 17.66 1.41 1.41',
      'M2 12h2',
      'M20 12h2',
      'm6.34 17.66-1.41 1.41',
      'm19.07 4.93-1.41 1.41',
    ],
  },
  moon: {
    paths: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'],
  },
} as const satisfies Record<string, IconMark>;

export type NavigationIconName = keyof typeof NAVIGATION_ICONS;

export function NavigationIcon({ name }: { name: NavigationIconName }) {
  const mark: IconMark = NAVIGATION_ICONS[name];
  return (
    <svg className="sidebar-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {mark.circles?.map((circle) => (
        <circle
          key={`${circle.cx}-${circle.cy}`}
          cx={circle.cx}
          cy={circle.cy}
          r={circle.r}
          fill="none"
          stroke="currentColor"
          strokeWidth={ICON_STROKE_WIDTH}
        />
      ))}
      {mark.paths?.map((path) => (
        <path
          key={path}
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth={ICON_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

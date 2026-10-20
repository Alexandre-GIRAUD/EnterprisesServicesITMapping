import type { ColorTheme } from './colorTheme';

type ThemeModeButtonProps = {
  theme: ColorTheme;
  onToggle: () => void;
};

/** Round header control. The glyph shows the current theme. */
export function ThemeModeButton({ theme, onToggle }: ThemeModeButtonProps) {
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      className="layout-theme-toggle"
      aria-pressed={isDark}
      aria-label={isDark ? 'Dark mode' : 'Light mode'}
      title={isDark ? 'Dark mode' : 'Light mode'}
      onClick={onToggle}
    >
      {isDark ? <MoonGlyph /> : <SunGlyph />}
    </button>
  );
}

function MoonGlyph() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M9.6 1.4a6.2 6.2 0 1 0 5 9.2 5.2 5.2 0 1 1-5-9.2z" />
    </svg>
  );
}

function SunGlyph() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="2.4" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M8 1.4V3.2" />
        <path d="M8 12.8V14.6" />
        <path d="M1.4 8H3.2" />
        <path d="M12.8 8H14.6" />
        <path d="M3.2 3.2 4.5 4.5" />
        <path d="M11.5 11.5 12.8 12.8" />
        <path d="M12.8 3.2 11.5 4.5" />
        <path d="M4.5 11.5 3.2 12.8" />
      </g>
    </svg>
  );
}

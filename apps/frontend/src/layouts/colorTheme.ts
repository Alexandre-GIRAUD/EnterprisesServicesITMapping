export const COLOR_THEME_STORAGE_KEY = 'flowra-theme';

export type ColorTheme = 'light' | 'dark';

export function storedColorTheme(stored: string | null): ColorTheme {
  return stored === 'dark' ? 'dark' : 'light';
}

export function toggledColorTheme(theme: ColorTheme): ColorTheme {
  return theme === 'dark' ? 'light' : 'dark';
}

/** Theme storage and DOM application, kept out of theme.tsx so that file
 *  exports only components and React Fast Refresh keeps working. */

export type Theme = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'piyp:theme';

export function systemDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

export function resolveTheme(theme: Theme, systemIsDark = systemDark()): 'light' | 'dark' {
  return theme === 'system' ? (systemIsDark ? 'dark' : 'light') : theme;
}

export function applyThemeToDocument(theme: Theme, resolved?: 'light' | 'dark') {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  const effective = resolved ?? resolveTheme(theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', effective === 'dark' ? '#17170F' : '#F7F7F4');
}

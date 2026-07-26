import { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react';
import type { ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export const THEME_STORAGE_KEY = 'piyp:theme';

interface ThemeValue { theme: Theme; setTheme: (t: Theme) => void; resolved: 'light' | 'dark'; }
const ThemeContext = createContext<ThemeValue | null>(null);

function systemDark() {
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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme());
  const [systemIsDark, setSystemIsDark] = useState(systemDark);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemIsDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolved: 'light' | 'dark' = theme === 'system' ? (systemIsDark ? 'dark' : 'light') : theme;

  useLayoutEffect(() => {
    applyThemeToDocument(theme, resolved);
  }, [theme, resolved]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem(THEME_STORAGE_KEY, t);
    applyThemeToDocument(t, t === 'system' ? resolveTheme(t, systemIsDark) : t);
  };

  return <ThemeContext.Provider value={{ theme, setTheme, resolved }}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

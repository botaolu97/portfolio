import { create } from 'zustand';

export type Theme = 'light' | 'dark';

/** Must match the inline script in index.html, which applies a saved theme before first paint. */
const STORAGE_KEY = 'mubu.theme';

function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

const media = window.matchMedia('(prefers-color-scheme: dark)');
const systemTheme = (): Theme => (media.matches ? 'dark' : 'light');

interface ThemeState {
  theme: Theme;
  /** True once the viewer picked a theme; until then it follows the system. */
  chosen: boolean;
  setTheme: (theme: Theme) => void;
}

const initial = savedTheme();

export const useTheme = create<ThemeState>()((set) => ({
  theme: initial ?? systemTheme(),
  chosen: initial !== null,
  setTheme: (theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Private mode or blocked storage: the choice just won't survive a reload.
    }
    document.documentElement.dataset.theme = theme;
    set({ theme, chosen: true });
  },
}));

media.addEventListener('change', () => {
  if (!useTheme.getState().chosen) useTheme.setState({ theme: systemTheme() });
});

import { flushSync } from 'react-dom';
import { create } from 'zustand';
import { tokenValues } from './tokens';

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

/**
 * Switches theme with the new colors growing as an ellipse from the bottom-right corner (where the
 * switch sits) until they fill the screen. Uses a view transition: the browser snapshots the old
 * page, the new theme is applied underneath, and the new page is revealed through a growing clip.
 * Switches instantly without view transitions or with reduced motion.
 */
export function switchTheme(theme: Theme) {
  const apply = () => useTheme.getState().setTheme(theme);
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    apply();
    return;
  }
  // flushSync so React (e.g. the canvas's color mode) has re-rendered before the new snapshot.
  const transition = document.startViewTransition(() => flushSync(apply));
  transition.ready
    .then(() => {
      // Percent radii follow the window's shape; √2 × the window reaches the far corner.
      document.documentElement.animate(
        { clipPath: ['ellipse(0% 0% at 100% 100%)', 'ellipse(142% 142% at 100% 100%)'] },
        {
          duration: Number.parseFloat(tokenValues['motion.duration.theme']),
          easing: tokenValues['motion.easing.theme'],
          pseudoElement: '::view-transition-new(root)',
        },
      );
    })
    .catch(() => {});
}

media.addEventListener('change', () => {
  if (!useTheme.getState().chosen) useTheme.setState({ theme: systemTheme() });
});

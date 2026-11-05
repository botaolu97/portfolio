import styles from './ThemeSwitch.module.css';
import { switchTheme, useTheme } from './theme';

const Sun = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

const Moon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </svg>
);

/** Light/dark switch fixed to the bottom-right corner, on every page and in both modes. */
export function ThemeSwitch() {
  const theme = useTheme((s) => s.theme);
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark theme"
      title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={styles.switch}
      onClick={() => switchTheme(dark ? 'light' : 'dark')}
    >
      <span className={styles.knob} />
      <span className={`${styles.icon} ${styles.sun}`}>
        <Sun />
      </span>
      <span className={`${styles.icon} ${styles.moon}`}>
        <Moon />
      </span>
    </button>
  );
}

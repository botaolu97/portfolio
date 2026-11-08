import { useEffect, useRef } from 'react';
import { tokenValues } from '../ui/tokens';
import styles from './LoadingBar.module.css';

const ms = (token: keyof typeof tokenValues) => Number.parseFloat(tokenValues[token]);

/**
 * A thin progress bar along the top of the canvas area. While `active` it creeps toward 90%
 * (slowing as it goes, so a long load never looks finished); when loading ends it runs to the end
 * and fades. Loads have no reliable byte count (maps and images come from many requests), so the
 * bar shows that something is happening rather than an exact share.
 */
export function LoadingBar({ active }: { active: boolean }) {
  const bar = useRef<HTMLDivElement>(null);
  const shown = useRef(false);

  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (active) {
      shown.current = true;
      el.getAnimations().forEach((a) => {
        a.cancel();
      });
      el.style.opacity = '1';
      el.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(0.9)' }], {
        duration: reduce ? 0 : ms('component.loading-bar.creep'),
        easing: 'cubic-bezier(0.1, 0.6, 0.2, 1)',
        fill: 'forwards',
      });
      return;
    }
    if (!shown.current) return;
    shown.current = false;
    const from = getComputedStyle(el).transform;
    el.getAnimations().forEach((a) => {
      a.cancel();
    });
    const finish = reduce ? 0 : ms('component.loading-bar.finish');
    el.animate(
      [
        { transform: from === 'none' ? 'scaleX(0)' : from, opacity: 1 },
        { transform: 'scaleX(1)', opacity: 1, offset: 0.6 },
        { transform: 'scaleX(1)', opacity: 0 },
      ],
      { duration: finish, easing: 'ease-out', fill: 'forwards' },
    );
  }, [active]);

  return (
    <div
      className={styles.track}
      role="progressbar"
      aria-label="Loading canvas"
      aria-hidden={!active}
    >
      <div ref={bar} className={styles.bar} />
    </div>
  );
}

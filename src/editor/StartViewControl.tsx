import { useReactFlow, useViewport } from '@xyflow/react';
import { useMapStore } from '../store/mapStore';
import { tokenValues } from '../ui/tokens';
import styles from './Editor.module.css';

/** Close enough to count as the same view (sub-pixel pan, tiny zoom differences). */
const same = (
  a: { x: number; y: number; zoom: number },
  b: { x: number; y: number; zoom: number },
) => Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.zoom - b.zoom) < 0.001;

/**
 * Bottom-left of the canvas: sets where visitors start on this canvas (the current view) and jumps
 * back to it. Without one, visitors start at your last view. Either way, each visitor's own moves
 * are remembered in their browser after that.
 */
export function StartViewControl() {
  const view = useViewport();
  const { setViewport } = useReactFlow();
  const startView = useMapStore((s) => s.startView);
  const setStartView = useMapStore((s) => s.setStartView);
  const atStart = startView ? same(view, startView) : false;

  return (
    <fieldset className={`${styles.panel} ${styles.startView}`} aria-label="Viewers' start view">
      <button
        type="button"
        className={styles.startViewButton}
        onClick={() => setStartView(view)}
        disabled={atStart}
        title="Visitors open this canvas at the view you're looking at now"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M3.5 14.5V2M3.5 2.5h8l-1.8 3 1.8 3h-8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {atStart
          ? "Viewers' start view"
          : startView
            ? "Set as viewers' start"
            : "Set viewers' start"}
      </button>
      {startView && !atStart && (
        <button
          type="button"
          className={styles.startViewButton}
          onClick={() =>
            setViewport(startView, {
              duration: Number.parseFloat(tokenValues['motion.duration.zoom']),
            })
          }
          title="Go to where visitors start"
        >
          Go to it
        </button>
      )}
    </fieldset>
  );
}

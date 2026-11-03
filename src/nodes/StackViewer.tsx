import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { asset } from '../content/api';
import type { StackItem } from '../store/schema';
import styles from './StackViewer.module.css';
import { layoutPrints, spreadColumns } from './stackLayout';

/**
 * A stack spread out over a blurred, grayed-out canvas. Clicking anywhere except an image, or
 * pressing Esc, closes it (the images go back into the pile).
 */
const stop = (e: React.SyntheticEvent) => e.stopPropagation();

export function StackViewer({ items, onClose }: { items: StackItem[]; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const columns = spreadColumns(items.length);
  const rows = Math.ceil(items.length / columns);
  const angles = layoutPrints(items, 1, 1).map((p) => p.angle);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      previous?.focus?.();
    };
  }, [onClose]);

  // Each cell's share of the window, so the whole spread always fits.
  const cell = {
    maxWidth: `calc((100vw - 2 * var(--stack-viewer-padding) - ${columns - 1} * var(--stack-viewer-gap)) / ${columns})`,
    maxHeight: `calc((100vh - 2 * var(--stack-viewer-padding) - ${rows - 1} * var(--stack-viewer-gap)) / ${rows})`,
  };

  return createPortal(
    <div
      ref={dialog}
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={`${items.length} stacked images`}
      tabIndex={-1}
      // React bubbles portal events up to the stack node; keep them here so closing doesn't reopen.
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onDoubleClick={stop}
      onPointerDown={stop}
      onContextMenu={stop}
      onKeyDown={stop}
    >
      <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${columns}, auto)` }}>
        {[...items].reverse().map((item, i) => (
          // biome-ignore lint/a11y/useKeyWithClickEvents: only stops the backdrop click; Esc closes
          <img
            key={item.id}
            className={styles.print}
            src={asset(item.src)}
            alt={item.alt}
            draggable={false}
            onClick={(e) => e.stopPropagation()}
            style={
              {
                ...cell,
                aspectRatio: `${item.width} / ${item.height}`,
                animationDelay: `${i * 40}ms`,
                '--_angle': `${angles[items.length - 1 - i]}deg`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <p className={styles.hint}>Click outside or press Esc to stack again</p>
    </div>,
    document.body,
  );
}

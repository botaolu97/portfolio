import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TextSize } from '../store/schema';
import { hideNativeScrollbar, OverlayScrollbar } from '../ui/OverlayScrollbar';
import { tokenValues } from '../ui/tokens';
import nodeStyles from './nodes.module.css';
import styles from './TextReader.module.css';
import { textSizeStyle } from './textSize';

interface Props {
  html: string;
  /** The text node's id, for saving edits. */
  nodeId: string;
  /** Edit mode: the text becomes editable once the zoom up has landed. */
  editable: boolean;
  /** The box's background, which grows to fill the window. */
  background: string;
  size: TextSize;
  /** The text box on the canvas: where the zoom starts and ends. */
  source: HTMLElement;
  /** Canvas zoom when opened. */
  zoom: number;
  /** Called when the zoom back starts. */
  onClosing: () => void;
  /** Called when the zoom back has finished. */
  onClosed: () => void;
}

interface Layout {
  /** The box on screen when the reader opened. */
  src: DOMRect;
  radius: number;
  /** Final scale and position of the text block. */
  scale: number;
  left: number;
  top: number;
}

const px = (value: string) => Number.parseFloat(value);

/**
 * The box's rectangle on screen at its normal size: if the reader opens while the box is lifted
 * by its hover scale, the zoom still starts from (and lands back on) the box's real size.
 */
function unscaledRect(el: HTMLElement, zoom: number) {
  const r = el.getBoundingClientRect();
  const width = el.offsetWidth * zoom;
  const height = el.offsetHeight * zoom;
  return new DOMRect(
    r.left + (r.width - width) / 2,
    r.top + (r.height - height) / 2,
    width,
    height,
  );
}

// Editing happens in the reader (edit mode only); checked inline so the build drops it.
const RichTextEditor = import.meta.env.DEV ? lazy(() => import('../editor/RichTextEditor')) : null;

// React passes portal events up to the node that rendered the reader; stop them here.
const stop = (e: React.SyntheticEvent) => e.stopPropagation();

/**
 * Full-screen reader for a text node. The box zooms up into it: the text block — the same layout
 * as on the canvas, just scaled — moves and scales to its reading position, inside one frame (the
 * box's background) whose clip grows from the box's rectangle to the window, so the text is cut
 * off exactly like the box at the start. Back or Esc runs the same animation in reverse. In edit
 * mode the text turns into the editor once the zoom has landed; edits save as you type.
 */
export function TextReader({
  html,
  nodeId,
  editable,
  background,
  size,
  source,
  zoom,
  onClosing,
  onClosed,
}: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const spacer = useRef<HTMLDivElement>(null);
  const block = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const layout = useRef<Layout | null>(null);
  const closing = useRef(false);
  // Static text while zooming (so the layout matches the box), the editor once landed.
  const [editing, setEditing] = useState(false);
  // The box's size in canvas px, read once.
  const [width] = useState(() => source.offsetWidth);
  const [height] = useState(() => source.offsetHeight);

  /** Zooming in decelerates into place; zooming out eases in and out so it reads as one move. */
  const timing = useCallback((direction: 'in' | 'out' = 'in'): KeyframeAnimationOptions => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const out = direction === 'out';
    return {
      duration: reduce
        ? 0
        : px(tokenValues[out ? 'motion.duration.zoom-out' : 'motion.duration.zoom']),
      easing: tokenValues[out ? 'motion.easing.zoom-out' : 'motion.easing.standard'],
      fill: 'both',
    };
  }, []);

  /** Keyframes at the box (canvas) end and the reader end. */
  const frames = useCallback(
    (l: Layout, scrollTop: number) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const { src } = l;
      return {
        blockAtBox: {
          transform: `translate(${src.left}px, ${src.top + scrollTop}px) scale(${zoom})`,
        },
        blockAtReader: { transform: `translate(${l.left}px, ${l.top}px) scale(${l.scale})` },
        frameAtBox: {
          clipPath: `inset(${src.top}px ${vw - src.right}px ${vh - src.bottom}px ${src.left}px round ${l.radius * zoom}px)`,
        },
        frameAtReader: { clipPath: 'inset(0px 0px 0px 0px round 0px)' },
      };
    },
    [zoom],
  );

  // Measure, size the scroll area, then zoom up.
  useLayoutEffect(() => {
    if (!block.current || !scroller.current || !spacer.current) return;
    const vars = getComputedStyle(scroller.current);
    const vw = scroller.current.clientWidth;
    const gutter = px(vars.getPropertyValue('--reader-gutter'));
    const ratio = px(vars.getPropertyValue('--reader-width-ratio'));
    const minWidth = px(vars.getPropertyValue('--reader-min-width'));
    const top = px(vars.getPropertyValue('--reader-top'));
    // A third of the window wide; on narrow windows at least --reader-min-width, never wider than
    // the window minus the gutters.
    const textWidth = Math.min(vw - 2 * gutter, Math.max(vw * ratio, minWidth));
    const scale = textWidth / width;
    const l: Layout = {
      src: unscaledRect(source, zoom),
      radius: px(getComputedStyle(source).borderTopLeftRadius) || 0,
      scale,
      left: (vw - width * scale) / 2,
      top,
    };
    layout.current = l;
    spacer.current.style.height = `${top * 2 + block.current.offsetHeight * scale}px`;
    const f = frames(l, 0);
    const t = timing();
    block.current.animate([f.blockAtBox, f.blockAtReader], t).finished.then(
      () => editable && !closing.current && setEditing(true),
      () => {},
    );
    frame.current?.animate([f.frameAtBox, f.frameAtReader], t);
    back.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
      ...t,
      delay: (t.duration as number) * 0.5,
    });
  }, [frames, timing, source, width, zoom, editable]);

  // Typing changes the text's height: keep the scroll area in step.
  useEffect(() => {
    const target = block.current;
    if (!target) return;
    const observer = new ResizeObserver(() => {
      const l = layout.current;
      if (l && spacer.current) {
        spacer.current.style.height = `${l.top * 2 + target.offsetHeight * l.scale}px`;
      }
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const close = useCallback(() => {
    const l = layout.current;
    if (closing.current || !l || !block.current) return;
    closing.current = true;
    setEditing(false);
    onClosing();
    // Zoom back from wherever the text is scrolled to, so the top of the text lands in the box.
    const f = frames(l, scroller.current?.scrollTop ?? 0);
    const t = timing('out');
    back.current?.animate([{ opacity: 1 }, { opacity: 0 }], {
      ...t,
      duration: (t.duration as number) * 0.4,
    });
    frame.current?.animate([f.frameAtReader, f.frameAtBox], t);
    block.current.animate([f.blockAtReader, f.blockAtBox], t).finished.then(onClosed, onClosed);
  }, [frames, timing, onClosing, onClosed]);

  // Focus and Esc are set up once: the parent re-renders on every keystroke while editing, and
  // re-running this would pull focus out of the editor.
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    back.current?.focus({ preventScroll: true });
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      closeRef.current();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      previous?.focus?.({ preventScroll: true });
    };
  }, []);

  const cloneClass = `${nodeStyles.text} ${nodeStyles.rich} ${nodeStyles.richStatic} ${styles.clone}`;

  return createPortal(
    <div
      className={`${styles.root} ${editable ? '' : styles.viewer}`}
      role="dialog"
      aria-modal="true"
      aria-label="Full text"
      onClick={stop}
      onDoubleClick={stop}
      onPointerDown={stop}
      onContextMenu={stop}
      onKeyDown={stop}
    >
      <div ref={frame} className={styles.frame} style={{ background }}>
        <div ref={scroller} className={`${styles.scroller} ${hideNativeScrollbar}`}>
          <div ref={spacer} className={styles.spacer}>
            <div ref={block} className={styles.block} style={{ width, ...textSizeStyle(size) }}>
              {editing && RichTextEditor ? (
                <div
                  className={`${nodeStyles.text} ${nodeStyles.rich} ${styles.clone} ${styles.editing}`}
                  style={{ minHeight: height }}
                >
                  <Suspense fallback={null}>
                    <RichTextEditor id={nodeId} html={html} onDone={close} autofocus="start" />
                  </Suspense>
                </div>
              ) : (
                <div
                  className={cloneClass}
                  style={{ minHeight: height }}
                  // Authored by the site owner in edit mode, never by visitors.
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              )}
            </div>
          </div>
        </div>
        <OverlayScrollbar target={scroller} />
      </div>
      <button ref={back} type="button" className={styles.back} onClick={close}>
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M10 3 5 8l5 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Back
      </button>
    </div>,
    document.body,
  );
}

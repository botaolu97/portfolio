import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { overlayRect, overlayRoot } from '../app/overlayRoot';
import type { TextSize } from '../store/schema';
import { hideNativeScrollbar, OverlayScrollbar } from '../ui/OverlayScrollbar';
import { tokenValues } from '../ui/tokens';
import nodeStyles from './nodes.module.css';
import { withLinkIcons } from './richLinks';
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
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** From a to b at an even rate on a log scale: equal ratios per step, so it looks evenly paced. */
const geometric = (a: number, b: number, t: number) => a * (b / a) ** t;
/**
 * How far a size v is from a to b (0–1). Moving the position by this fraction keeps one point
 * fixed on screen, as a camera zoom does. Falls back to t when the size doesn't change.
 */
const along = (a: number, b: number, v: number, t: number) =>
  Math.abs(b - a) < 1e-6 ? t : (v - a) / (b - a);
/** Keyframes per zoom: enough that the straight segments between them don't show. */
const ZOOM_STEPS = 24;

/**
 * The box's rectangle at its normal size, relative to the canvas area the reader fills: if the
 * reader opens while the box is lifted by its hover scale, the zoom still starts from (and lands
 * back on) the box's real size.
 */
function unscaledRect(el: HTMLElement, zoom: number) {
  const r = el.getBoundingClientRect();
  const area = overlayRect();
  const width = el.offsetWidth * zoom;
  const height = el.offsetHeight * zoom;
  return new DOMRect(
    r.left - area.left + (r.width - width) / 2,
    r.top - area.top + (r.height - height) / 2,
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
 * box's background) that grows from the box's rectangle to the window and clips the text, so the
 * text is cut off exactly like the box at the start. Back or Esc runs the same animation in reverse. In edit
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

  /**
   * Keyframes from the reader (first) to the box (last). Sizes change on a log scale — equal ratios
   * per step — about a fixed point, for the text and the background alike. The background shrinks
   * far more than the text (window to box, vs. half the window to box); interpolated linearly
   * in pixels, most of its visible shrink would land in the last frames, after the text has
   * settled, and read as a second shrink.
   *
   * Everything moves by transform only, so the browser runs it all on the GPU in the same frames.
   * (A clip-path on the background runs on the main thread in Chrome and falls behind the text
   * whenever the page is busy.) The frame — the window-sized background that holds the text —
   * scales to the box's rectangle; the text's transform undoes that scale and applies its own.
   */
  const frames = useCallback(
    (l: Layout, scrollTop: number) => {
      const vw = frame.current?.clientWidth || window.innerWidth;
      const vh = frame.current?.clientHeight || window.innerHeight;
      const { src } = l;
      const block: Keyframe[] = [];
      const sheet: Keyframe[] = [];
      const corners: Keyframe[] = [];
      for (let i = 0; i <= ZOOM_STEPS; i++) {
        const t = i / ZOOM_STEPS;
        // Background: from the whole window to the box, on screen.
        const w = geometric(vw, Math.max(src.width, 1), t);
        const h = geometric(vh, Math.max(src.height, 1), t);
        const left = lerp(0, src.left, along(vw, src.width, w, t));
        const top = lerp(0, src.top, along(vh, src.height, h, t));
        const sx = w / vw;
        const sy = h / vh;
        sheet.push({ transform: `translate(${left}px, ${top}px) scale(${sx}, ${sy})` });
        // Rounded like the box once it gets there (in the frame's own, unscaled coordinates).
        const radius = lerp(0, l.radius * zoom, along(vw, src.width, w, t));
        corners.push({ borderRadius: `${radius / sx}px / ${radius / sy}px` });
        // Text: its scale goes from the reader's to the canvas zoom, on screen.
        const scale = geometric(l.scale, zoom, t);
        const k = along(l.scale, zoom, scale, t);
        const x = lerp(l.left, src.left, k);
        const y = lerp(l.top - scrollTop, src.top, k);
        // …expressed inside the scaled frame and the scrolled text.
        block.push({
          transform: `translate(${(x - left) / sx}px, ${(y - top) / sy + scrollTop}px) scale(${scale / sx}, ${scale / sy})`,
        });
      }
      return { block, sheet, corners };
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
    // Half the canvas area wide; on narrow windows at least --reader-min-width, never wider than
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
    block.current.animate(f.block.toReversed(), t).finished.then(
      () => editable && !closing.current && setEditing(true),
      () => {},
    );
    frame.current?.animate(f.sheet.toReversed(), t);
    frame.current?.animate(f.corners.toReversed(), t);
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
    frame.current?.animate(f.sheet, t);
    frame.current?.animate(f.corners, t);
    block.current.animate(f.block, t).finished.then(onClosed, onClosed);
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
                  dangerouslySetInnerHTML={{ __html: withLinkIcons(html) }}
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
    overlayRoot(),
  );
}

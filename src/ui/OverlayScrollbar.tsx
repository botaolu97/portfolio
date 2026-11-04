import { type RefObject, useEffect, useRef, useState } from 'react';
import styles from './OverlayScrollbar.module.css';
import { tokenValues } from './tokens';

/** Space between the thumb's range and the top and bottom edges: the same inset as on the right. */
const MARGIN = Number.parseFloat(tokenValues['component.scrollbar.inset']);

/** Class for the scroll container: hides the native scrollbar. */
export const hideNativeScrollbar = styles.hideNative;

/**
 * Custom vertical scrollbar for a scroll container: just a thumb, no track, inset --scrollbar-inset
 * from the right, top and bottom edges, that fades in while scrolling and fades out --scrollbar-hide-delay after scrolling stops. It can be dragged. Render
 * it as a sibling of the container, inside a positioned parent that covers the same area.
 */
export function OverlayScrollbar({ target }: { target: RefObject<HTMLElement | null> }) {
  const thumb = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [dragging, setDragging] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const drag = useRef<{ startY: number; startScroll: number } | null>(null);

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const hideDelay = Number.parseFloat(tokenValues['component.scrollbar.hide-delay']);
    const minThumb = Number.parseFloat(tokenValues['component.scrollbar.min-thumb']);

    // Size and place the thumb from the scroll position (no React render per scroll frame).
    const place = () => {
      const node = thumb.current;
      if (!node) return false;
      const { scrollTop, scrollHeight, clientHeight } = el;
      const range = clientHeight - MARGIN * 2;
      if (scrollHeight <= clientHeight + 1) {
        node.style.display = 'none';
        return false;
      }
      const size = Math.max(minThumb, (clientHeight / scrollHeight) * range);
      const top = MARGIN + (scrollTop / (scrollHeight - clientHeight)) * (range - size);
      node.style.display = '';
      node.style.height = `${size}px`;
      node.style.transform = `translateY(${top}px)`;
      return true;
    };

    const onScroll = () => {
      if (!place()) return;
      setVisible(true);
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        if (!drag.current) setVisible(false);
      }, hideDelay);
    };

    place();
    el.addEventListener('scroll', onScroll, { passive: true });
    // Content can grow (editing) or the window can resize.
    const observer = new ResizeObserver(() => place());
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', onScroll);
      observer.disconnect();
      clearTimeout(hideTimer.current);
    };
  }, [target]);

  const onPointerDown = (e: React.PointerEvent) => {
    const el = target.current;
    if (!el) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startScroll: el.scrollTop };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const el = target.current;
    const node = thumb.current;
    if (!drag.current || !el || !node) return;
    const range = el.clientHeight - MARGIN * 2 - node.offsetHeight;
    const scrollable = el.scrollHeight - el.clientHeight;
    el.scrollTop =
      drag.current.startScroll + ((e.clientY - drag.current.startY) / range) * scrollable;
  };

  const endDrag = () => {
    drag.current = null;
    setDragging(false);
    // Restart the fade-out countdown from the end of the drag.
    target.current?.dispatchEvent(new Event('scroll'));
  };

  return (
    <div
      ref={thumb}
      className={`${styles.thumb} ${visible ? styles.visible : ''} ${dragging ? styles.dragging : ''}`}
      aria-hidden="true"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    />
  );
}

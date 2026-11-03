import { useReactFlow } from '@xyflow/react';
import { useEffect } from 'react';

const ZOOM_KEYS = new Set(['=', '+', '-', '_', '0']);

/**
 * On canvas pages, every zoom gesture zooms the canvas, never the browser page, so the top bar,
 * panels and theme switch keep their size. Covers trackpad pinch and ⌘/Ctrl + wheel over the
 * interface (React Flow already handles them over the canvas), ⌘/Ctrl + = − 0, and Safari's
 * gesture events. Pages without a canvas keep normal browser zoom.
 *
 * Not covered: input that reaches a live demo's sandboxed iframe (a pinch over the demo, or zoom
 * keys while the demo has focus) can't be intercepted by Mubu.
 */
export function usePageZoomGuard() {
  const { zoomIn, zoomOut, zoomTo, getZoom, fitView } = useReactFlow();

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      // Pinch arrives as a ctrl + wheel event. React Flow has handled it if it was over the canvas.
      if (!(e.ctrlKey || e.metaKey) || e.defaultPrevented) return;
      e.preventDefault();
      zoomTo(getZoom() * 2 ** (-e.deltaY * 0.01));
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || !ZOOM_KEYS.has(e.key)) return;
      e.preventDefault();
      if (e.key === '0') fitView({ padding: 0.15, maxZoom: 1, duration: 200 });
      else if (e.key === '-' || e.key === '_') zoomOut({ duration: 150 });
      else zoomIn({ duration: 150 });
    };
    const preventGesture = (e: Event) => e.preventDefault();

    document.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown, true);
    for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
      document.addEventListener(type, preventGesture, { passive: false });
    }
    return () => {
      document.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown, true);
      for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
        document.removeEventListener(type, preventGesture);
      }
    };
  }, [zoomIn, zoomOut, zoomTo, getZoom, fitView]);
}

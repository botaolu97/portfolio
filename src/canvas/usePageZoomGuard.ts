import { useReactFlow } from '@xyflow/react';
import { useEffect } from 'react';
import { type DemoBridgeMessage, MAX_ZOOM, MIN_ZOOM, wheelZoomFactor } from './zoom';

const ZOOM_KEYS = new Set(['=', '+', '-', '_', '0']);

/**
 * On canvas pages, every zoom gesture zooms the canvas, never the browser page, so the top bar,
 * panels and theme switch keep their size:
 * - pinch / ⌘-scroll over the interface, and over scrollable nodes (code blocks), which React Flow
 *   leaves alone ("nowheel") — zooms around the pointer;
 * - pinch / ⌘-scroll and zoom keys inside a live demo, forwarded by the demo bridge that Mubu
 *   injects into demo pages (see vite-plugin-mubu-content.ts);
 * - ⌘/Ctrl + = − 0, and Safari's gesture events.
 * Pages without a canvas keep normal browser zoom.
 */
export function usePageZoomGuard() {
  const { zoomIn, zoomOut, fitView, getViewport, setViewport } = useReactFlow();

  useEffect(() => {
    /** Zooms so the canvas point under (clientX, clientY) stays put. */
    const zoomAt = (clientX: number, clientY: number, factor: number) => {
      const pane = document.querySelector('.react-flow')?.getBoundingClientRect();
      if (!pane) return;
      const { x, y, zoom } = getViewport();
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
      const px = clientX - pane.left;
      const py = clientY - pane.top;
      const k = next / zoom;
      setViewport({ x: px - (px - x) * k, y: py - (py - y) * k, zoom: next });
    };

    const zoomKey = (key: string) => {
      if (key === '0') fitView({ padding: 0.15, maxZoom: 1, duration: 200 });
      else if (key === '-' || key === '_') zoomOut({ duration: 150 });
      else zoomIn({ duration: 150 });
    };

    const onWheel = (e: WheelEvent) => {
      // Pinch arrives as a ctrl + wheel event.
      if (!(e.ctrlKey || e.metaKey)) return;
      const inScrollableNode = (e.target as Element | null)?.closest?.('.react-flow .nowheel');
      // React Flow zoomed (and prevented) it over the canvas; elsewhere it's ours.
      if (e.defaultPrevented && !inScrollableNode) return;
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, wheelZoomFactor(e.deltaY));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || !ZOOM_KEYS.has(e.key)) return;
      e.preventDefault();
      zoomKey(e.key);
    };

    const onMessage = (e: MessageEvent<DemoBridgeMessage>) => {
      if (e.data?.source !== 'mubu-demo') return;
      // Only trust messages from a demo iframe on this canvas.
      const frame = [...document.querySelectorAll<HTMLIFrameElement>('.react-flow iframe')].find(
        (f) => f.contentWindow === e.source,
      );
      if (!frame) return;
      if (e.data.type === 'zoom-key') {
        if (ZOOM_KEYS.has(e.data.key)) zoomKey(e.data.key);
        return;
      }
      // The iframe is scaled to fit its node: map its coordinates to the page.
      const rect = frame.getBoundingClientRect();
      const scale = frame.offsetWidth ? rect.width / frame.offsetWidth : 1;
      zoomAt(
        rect.left + e.data.clientX * scale,
        rect.top + e.data.clientY * scale,
        wheelZoomFactor(e.data.deltaY),
      );
    };

    const preventGesture = (e: Event) => e.preventDefault();

    document.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('message', onMessage);
    for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
      document.addEventListener(type, preventGesture, { passive: false });
    }
    return () => {
      document.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('message', onMessage);
      for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
        document.removeEventListener(type, preventGesture);
      }
    };
  }, [zoomIn, zoomOut, fitView, getViewport, setViewport]);
}

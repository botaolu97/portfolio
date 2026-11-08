import { ReactFlowProvider } from '@xyflow/react';
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Canvas } from '../canvas/Canvas';
import { fetchMap } from '../content/api';
import { useMapStore } from '../store/mapStore';
import { CanvasPanel } from './CanvasPanel';
import { CANVAS_LAYER_ATTR, finishCanvasSlide } from './canvasTransition';
import { LoadingBar } from './LoadingBar';
import styles from './MapPage.module.css';
import { OVERLAY_ROOT_ATTR } from './overlayRoot';
import { SNAPSHOT } from './snapshot';

// Checked inline (not via EDITABLE) so the production build drops the chunk entirely. Snapshot
// mode never loads it: nothing is edited or saved while a snapshot is taken.
const Editor = import.meta.env.DEV && !SNAPSHOT ? lazy(() => import('../editor/Editor')) : null;

/** Longest the loading bar waits for a canvas's images before finishing. */
const IMAGES_TIMEOUT_MS = 2500;

/**
 * The images actually inside the canvas area. React Flow also renders boxes just outside it, and
 * their lazy images never load until scrolled into view, so waiting on them would always run to
 * the timeout. Measured against the layer itself, so the slide-in transform doesn't matter.
 */
function imagesInView(layer: HTMLElement) {
  const box = layer.getBoundingClientRect();
  return [...layer.querySelectorAll('img')].filter((img) => {
    const r = img.getBoundingClientRect();
    return (
      r.width > 0 &&
      r.right > box.left &&
      r.left < box.right &&
      r.bottom > box.top &&
      r.top < box.bottom
    );
  });
}

export function MapPage({ slug }: { slug: string }) {
  const layer = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [error, setError] = useState<string | null>(null);
  // The canvas's images have loaded (or a few seconds passed): the loading bar finishes then.
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setSettled(false);
    fetchMap(slug)
      .then((doc) => {
        if (cancelled) return;
        useMapStore.getState().load(slug, doc);
        document.title = `${doc.title} · Mubu`;
        setState('ready');
      })
      .catch(() => !cancelled && setState('missing'));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  const onError = useCallback((message: string | null) => setError(message), []);

  // Once the canvas is on screen, wait for the images in view (at most IMAGES_TIMEOUT_MS). React
  // Flow draws the boxes a frame or two after the map loads, so first wait for them to appear.
  useEffect(() => {
    if (state === 'missing') setSettled(true);
    if (state !== 'ready') return;
    let cancelled = false;
    let frame = 0;
    const started = performance.now();
    const deadline = setTimeout(() => !cancelled && setSettled(true), IMAGES_TIMEOUT_MS);
    const empty = useMapStore.getState().nodes.length === 0;
    const waitForBoxes = () => {
      const el = layer.current;
      const drawn = el?.querySelector('.react-flow__node') !== null;
      if (!el || (!drawn && !empty && performance.now() - started < IMAGES_TIMEOUT_MS)) {
        frame = requestAnimationFrame(waitForBoxes);
        return;
      }
      const images = imagesInView(el);
      // Each image's load (or failure). Not decode(): for a lazy image that hasn't started loading
      // it settles straight away, before anything is on screen.
      const loaded = (img: HTMLImageElement) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.addEventListener('load', () => resolve(), { once: true });
              img.addEventListener('error', () => resolve(), { once: true });
            });
      void Promise.all(images.map(loaded)).then(() => !cancelled && setSettled(true));
    };
    frame = requestAnimationFrame(waitForBoxes);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearTimeout(deadline);
    };
  }, [state]);

  // A canvas switch slides the previous canvas out and this one in once it's on screen.
  useLayoutEffect(() => {
    if (state !== 'loading') finishCanvasSlide(layer.current);
  }, [state]);

  // The panel stays put while canvases switch; the canvas area on its right changes.
  return (
    <div className={`${styles.page} ${SNAPSHOT ? styles.snapshot : ''}`}>
      {!SNAPSHOT && <CanvasPanel slug={slug} />}
      <main className={styles.area} {...{ [OVERLAY_ROOT_ATTR]: '' }}>
        {!SNAPSHOT && <LoadingBar active={state === 'loading' || !settled} />}
        {state === 'missing' && (
          <div className={styles.message}>
            <p>This canvas doesn't exist. Pick one on the left.</p>
          </div>
        )}
        {state === 'loading' && <div className={styles.message}>Loading…</div>}
        {state === 'ready' && (
          <ReactFlowProvider>
            <div ref={layer} className={styles.canvas} {...{ [CANVAS_LAYER_ATTR]: '' }}>
              <Canvas onError={onError} />
            </div>
            {Editor && (
              <Suspense fallback={null}>
                <Editor key={slug} error={error} onError={onError} />
              </Suspense>
            )}
          </ReactFlowProvider>
        )}
      </main>
    </div>
  );
}

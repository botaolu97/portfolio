import { ReactFlowProvider } from '@xyflow/react';
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Canvas } from '../canvas/Canvas';
import { fetchMap } from '../content/api';
import { useMapStore } from '../store/mapStore';
import { CanvasSwitcher } from './CanvasSwitcher';
import { CANVAS_LAYER_ATTR, finishCanvasSlide } from './canvasTransition';
import styles from './MapPage.module.css';

// Checked inline (not via EDITABLE) so the production build drops the chunk entirely.
const Editor = import.meta.env.DEV ? lazy(() => import('../editor/Editor')) : null;

/** The switcher, showing the open canvas's (live) title. */
function Switcher({ slug }: { slug: string }) {
  const title = useMapStore((s) => s.title);
  return <CanvasSwitcher slug={slug} title={title} />;
}

export function MapPage({ slug }: { slug: string }) {
  const layer = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
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

  // A canvas switch slides the previous canvas out and this one in once it's on screen.
  useLayoutEffect(() => {
    if (state !== 'loading') finishCanvasSlide(layer.current);
  }, [state]);

  if (state === 'missing') {
    return (
      <div className={styles.message}>
        <p>This canvas doesn't exist.</p>
        <CanvasSwitcher slug={null} title="Choose a canvas" />
      </div>
    );
  }
  if (state === 'loading') return <div className={styles.message}>Loading…</div>;

  return (
    <ReactFlowProvider>
      <div className={styles.page}>
        <div ref={layer} className={styles.canvas} {...{ [CANVAS_LAYER_ATTR]: '' }}>
          <Canvas onError={onError} />
        </div>
        {Editor && (
          <Suspense fallback={null}>
            <Editor key={slug} error={error} onError={onError} />
          </Suspense>
        )}
        <Switcher slug={slug} />
      </div>
    </ReactFlowProvider>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useCanvasIndex } from '../app/canvasIndex';
import { CANVAS_LAYER_ATTR } from '../app/canvasTransition';
import { captureSnapshot, saveMap } from '../content/api';
import { toDoc, useMapStore } from '../store/mapStore';
import { type SaveStatus, useUiStore } from '../store/uiStore';

const DELAY_MS = 500;
/** A canvas with no snapshot gets its first one this long after opening (once it's drawn). */
const FIRST_SNAPSHOT_DELAY_MS = 1500;

/** The canvas area's size on screen: snapshots are taken at this size. */
function canvasSize() {
  const rect = document.querySelector(`[${CANVAS_LAYER_ATTR}]`)?.getBoundingClientRect();
  return rect && rect.width >= 200 && rect.height >= 200
    ? { width: Math.round(rect.width), height: Math.round(rect.height) }
    : null;
}

/** Asks the dev server to picture the canvas; the panel picks up the new snapshot. */
function retakeSnapshot(slug: string, size = canvasSize()) {
  if (!size) return;
  captureSnapshot(slug, size)
    .then(useCanvasIndex.getState().setMaps)
    .catch(() => {});
}

/**
 * Writes the open map to disk shortly after each change (dev server only), then has the canvas
 * panel's snapshot retaken when you leave the canvas.
 */
export function useAutosave() {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [error, setError] = useState<string | null>(null);
  const lastSaved = useRef<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const snapshot = () => {
      const state = useMapStore.getState();
      return state.slug ? { slug: state.slug, json: JSON.stringify(toDoc(state)) } : null;
    };
    lastSaved.current = snapshot()?.json ?? null;
    const slug = useMapStore.getState().slug;
    const index = useCanvasIndex.getState();
    // Snapshots are retaken when you leave the canvas (switching), if anything was saved while it
    // was open (edits or moving the view). A canvas with no snapshot at all gets one right away.
    let changed = false;
    let firstSnap: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    void (index.loaded ? Promise.resolve(index.maps) : index.refresh()).then((maps) => {
      if (disposed) return;
      const entry = maps.find((m) => m.slug === slug);
      if (slug && entry && !entry.thumbAt) {
        firstSnap = setTimeout(() => retakeSnapshot(slug), FIRST_SNAPSHOT_DELAY_MS);
      }
    });

    const unsubscribe = useMapStore.subscribe(() => {
      const current = snapshot();
      if (!current || current.json === lastSaved.current) return;
      setStatus('pending');
      clearTimeout(timer);
      timer = setTimeout(async () => {
        setStatus('saving');
        try {
          useCanvasIndex.getState().setMaps(await saveMap(current.slug, JSON.parse(current.json)));
          lastSaved.current = current.json;
          changed = true;
          setStatus(snapshot()?.json === current.json ? 'saved' : 'pending');
          setError(null);
        } catch (err) {
          setStatus('error');
          setError((err as Error).message);
        }
      }, DELAY_MS);
    });
    return () => {
      clearTimeout(timer);
      disposed = true;
      clearTimeout(firstSnap);
      unsubscribe();
      // Leaving the canvas (switching): write any save still waiting, while the store still holds
      // this canvas, then retake its snapshot (at the size measured now).
      const size = canvasSize();
      const last = snapshot();
      if (last && last.json !== lastSaved.current) {
        saveMap(last.slug, JSON.parse(last.json))
          .then((maps) => {
            useCanvasIndex.getState().setMaps(maps);
            retakeSnapshot(last.slug, size);
          })
          .catch(() => {});
      } else if (changed && slug) {
        retakeSnapshot(slug, size);
      }
    };
  }, []);

  // The canvas switcher shows this as a small status dot.
  useEffect(() => {
    useUiStore.getState().setSaveStatus(status);
  }, [status]);
  useEffect(() => () => useUiStore.getState().setSaveStatus(null), []);

  return { status, error };
}

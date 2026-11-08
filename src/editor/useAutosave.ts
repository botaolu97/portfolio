import { useEffect, useRef, useState } from 'react';
import { useCanvasIndex } from '../app/canvasIndex';
import { CANVAS_LAYER_ATTR } from '../app/canvasTransition';
import { captureSnapshot, saveMap } from '../content/api';
import { toDoc, useMapStore } from '../store/mapStore';
import { type SaveStatus, useUiStore } from '../store/uiStore';

const DELAY_MS = 500;
/** Quiet time after a save before the canvas panel's snapshot is retaken. */
const SNAPSHOT_DELAY_MS = 1500;

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
 * panel's snapshot retaken once things are quiet.
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
    let snapTimer: ReturnType<typeof setTimeout> | undefined;
    let snapDue = false;
    const scheduleSnapshot = (target: string) => {
      snapDue = true;
      clearTimeout(snapTimer);
      snapTimer = setTimeout(() => {
        snapDue = false;
        retakeSnapshot(target);
      }, SNAPSHOT_DELAY_MS);
    };
    // A canvas with no snapshot yet, or edited since its last one (e.g. by hand), gets one now.
    void (index.loaded ? Promise.resolve(index.maps) : index.refresh()).then((maps) => {
      const entry = maps.find((m) => m.slug === slug);
      if (slug && entry && (!entry.thumbAt || entry.thumbAt < Date.parse(entry.updatedAt))) {
        scheduleSnapshot(slug);
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
          scheduleSnapshot(current.slug);
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
      clearTimeout(snapTimer);
      unsubscribe();
      // Leaving the canvas (e.g. switching) with a save still waiting: write it now, while the
      // store still holds this canvas, then retake its snapshot (at the size measured now).
      const size = canvasSize();
      const last = snapshot();
      if (last && last.json !== lastSaved.current) {
        saveMap(last.slug, JSON.parse(last.json))
          .then((maps) => {
            useCanvasIndex.getState().setMaps(maps);
            retakeSnapshot(last.slug, size);
          })
          .catch(() => {});
      } else if (snapDue && slug) {
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

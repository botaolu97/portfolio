import { useEffect, useRef, useState } from 'react';
import { saveMap } from '../content/api';
import { toDoc, useMapStore } from '../store/mapStore';
import { type SaveStatus, useUiStore } from '../store/uiStore';

const DELAY_MS = 500;

/** Writes the open map to disk shortly after each change (dev server only). */
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

    const unsubscribe = useMapStore.subscribe(() => {
      const current = snapshot();
      if (!current || current.json === lastSaved.current) return;
      setStatus('pending');
      clearTimeout(timer);
      timer = setTimeout(async () => {
        setStatus('saving');
        try {
          await saveMap(current.slug, JSON.parse(current.json));
          lastSaved.current = current.json;
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
      unsubscribe();
    };
  }, []);

  // The canvas switcher shows this as a small status dot.
  useEffect(() => {
    useUiStore.getState().setSaveStatus(status);
  }, [status]);
  useEffect(() => () => useUiStore.getState().setSaveStatus(null), []);

  return { status, error };
}

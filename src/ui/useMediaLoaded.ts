import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Whether an <img>, <video> or <iframe> has loaded enough to show (or failed: no spinner forever).
 * Resets when `src` changes. `ref` covers media that finished loading before React attached its
 * handlers (e.g. cached images).
 */
export function useMediaLoaded<T extends HTMLImageElement | HTMLVideoElement | HTMLIFrameElement>(
  src: string | undefined,
) {
  const [loaded, setLoaded] = useState(false);
  const node = useRef<T | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new src starts loading again
  useEffect(() => {
    const el = node.current;
    if (el instanceof HTMLImageElement) setLoaded(el.complete && el.naturalWidth > 0);
    else if (el instanceof HTMLVideoElement) setLoaded(el.readyState >= 1);
    else setLoaded(false);
  }, [src]);
  const ref = useCallback((el: T | null) => {
    node.current = el;
  }, []);
  const done = useCallback(() => setLoaded(true), []);
  return { loaded, ref, done };
}

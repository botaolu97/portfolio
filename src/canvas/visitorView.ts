import { roundViewport } from '../store/mapStore';
import { type Viewport, viewport } from '../store/schema';

/**
 * Visitors' own view of each canvas, remembered in their browser, so switching away and back (or
 * coming back another day) returns them to where they were. A convenience only: if storage is
 * unavailable they just start at the canvas's start view again.
 */
const key = (slug: string) => `mubu.view.${slug}`;

export function readVisitorView(slug: string): Viewport | undefined {
  try {
    const raw = localStorage.getItem(key(slug));
    if (!raw) return undefined;
    const parsed = viewport.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export function writeVisitorView(slug: string, view: Viewport) {
  try {
    localStorage.setItem(key(slug), JSON.stringify(roundViewport(view)));
  } catch {
    // Private mode or blocked storage: the view just isn't remembered.
  }
}

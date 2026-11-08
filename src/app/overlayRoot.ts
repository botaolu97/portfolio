/**
 * The canvas area (right of the canvas panel). Everything that takes over the screen (the text
 * reader, the stack viewer, the video viewer) is drawn inside it, so the panel and the canvas
 * never share space.
 */
export const OVERLAY_ROOT_ATTR = 'data-overlay-root';

export function overlayRoot(): HTMLElement {
  return document.querySelector<HTMLElement>(`[${OVERLAY_ROOT_ATTR}]`) ?? document.body;
}

/** The canvas area's rectangle on screen (the whole window if there's no panel). */
export function overlayRect(): DOMRect {
  const root = overlayRoot();
  return root === document.body
    ? new DOMRect(0, 0, window.innerWidth, window.innerHeight)
    : root.getBoundingClientRect();
}

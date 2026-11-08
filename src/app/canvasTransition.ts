import { tokenValues } from '../ui/tokens';
import { overlayRect, overlayRoot } from './overlayRoot';

/**
 * Slide between canvases. Only one canvas can be live (they share the map store), so the canvas
 * being left is kept as a static snapshot (a clone of its DOM) while the next one loads; then both
 * slide together: up when moving down the order (canvas 2 → 3), down when moving back.
 */

export type SlideDirection = 'up' | 'down';

/** Marks the element holding the live canvas (MapPage). */
export const CANVAS_LAYER_ATTR = 'data-canvas-layer';

let pending: { ghost: HTMLElement; direction: SlideDirection } | null = null;

/** Freezes the current canvas into a snapshot that covers it until the next one is ready. */
export function beginCanvasSlide(direction: SlideDirection) {
  pending?.ghost.remove();
  pending = null;
  const layer = document.querySelector<HTMLElement>(`[${CANVAS_LAYER_ATTR}]`);
  if (!layer || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const rect = layer.getBoundingClientRect();
  const ghost = layer.cloneNode(true) as HTMLElement;
  ghost.removeAttribute(CANVAS_LAYER_ATTR);
  // Live media would reload in the copy: swap in plain blocks of the same size and place.
  for (const media of ghost.querySelectorAll<HTMLElement>('iframe, video')) {
    const block = document.createElement('div');
    block.style.cssText = media.style.cssText;
    block.className = media.className;
    block.style.background =
      media.tagName === 'VIDEO' ? 'var(--video-backdrop)' : 'var(--demo-page-bg)';
    media.replaceWith(block);
  }
  // Inside the canvas area, which clips: the sliding canvases and their shadows never reach the
  // canvas panel.
  const area = overlayRect();
  Object.assign(ghost.style, {
    position: 'absolute',
    left: `${rect.left - area.left}px`,
    top: `${rect.top - area.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    zIndex: '1',
    pointerEvents: 'none',
  });
  overlayRoot().appendChild(ghost);
  pending = { ghost, direction };
}

/** The next canvas is on screen: slide it in and the snapshot out, together. */
export function finishCanvasSlide(layer: HTMLElement | null) {
  const current = pending;
  pending = null;
  if (!current) return;
  const { ghost, direction } = current;
  const timing: KeyframeAnimationOptions = {
    duration: Number.parseFloat(tokenValues['motion.duration.slide']),
    easing: tokenValues['motion.easing.slide'],
    fill: 'both',
  };
  // Both canvases cast a shadow while moving, so they read as separate sheets.
  const shadow = 'var(--canvas-slide-shadow)';
  ghost.style.boxShadow = shadow;
  if (layer) layer.style.boxShadow = shadow;
  const out = direction === 'up' ? '-100%' : '100%';
  const into = direction === 'up' ? '100%' : '-100%';
  layer
    ?.animate([{ transform: `translateY(${into})` }, { transform: 'translateY(0)' }], timing)
    .finished.then(
      () => layer.style.removeProperty('box-shadow'),
      () => layer.style.removeProperty('box-shadow'),
    );
  ghost
    .animate([{ transform: 'translateY(0)' }, { transform: `translateY(${out})` }], timing)
    .finished.then(
      () => ghost.remove(),
      () => ghost.remove(),
    );
}

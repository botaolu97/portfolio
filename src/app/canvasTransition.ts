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

let copies = 0;

/**
 * A static copy of the live canvas (its DOM), for the slide and for the canvas panel's picture of
 * the view you just left. Live media would reload in a copy, so iframes and videos become plain
 * blocks of the same size and place; drawing layers are dropped; ids are made unique (and the
 * references to them updated) so the copy's dot grid and arrowheads don't borrow the live ones.
 */
export function copyCanvas(layer: HTMLElement): HTMLElement {
  const copy = layer.cloneNode(true) as HTMLElement;
  copy.removeAttribute(CANVAS_LAYER_ATTR);
  for (const media of copy.querySelectorAll<HTMLElement>('iframe, video')) {
    const block = document.createElement('div');
    block.style.cssText = media.style.cssText;
    block.className = media.className;
    block.style.background =
      media.tagName === 'VIDEO' ? 'var(--video-backdrop)' : 'var(--demo-page-bg)';
    media.replaceWith(block);
  }
  for (const canvas of copy.querySelectorAll('canvas')) canvas.remove();
  const suffix = `-copy${++copies}`;
  const renamed = new Map<string, string>();
  for (const el of copy.querySelectorAll<Element>('[id]')) {
    renamed.set(el.id, el.id + suffix);
    el.id += suffix;
  }
  if (renamed.size) {
    for (const el of copy.querySelectorAll<Element>('*')) {
      for (const attr of ['fill', 'stroke', 'marker-start', 'marker-end', 'href', 'xlink:href']) {
        const value = el.getAttribute(attr);
        if (!value?.includes('#')) continue;
        el.setAttribute(
          attr,
          value.replace(/#([^)\s'"]+)/g, (m, id: string) =>
            renamed.has(id) ? `#${renamed.get(id)}` : m,
          ),
        );
      }
      const style = el.getAttribute('style');
      if (style?.includes('url(')) {
        el.setAttribute(
          'style',
          style.replace(/url\(["']?#([^)"']+)["']?\)/g, (m, id: string) =>
            renamed.has(id) ? `url(#${renamed.get(id)})` : m,
          ),
        );
      }
    }
  }
  return copy;
}

/** Freezes the current canvas into a snapshot that covers it until the next one is ready. */
export function beginCanvasSlide(direction: SlideDirection) {
  pending?.ghost.remove();
  pending = null;
  const layer = document.querySelector<HTMLElement>(`[${CANVAS_LAYER_ATTR}]`);
  if (!layer || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const rect = layer.getBoundingClientRect();
  const ghost = copyCanvas(layer);
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

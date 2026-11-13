import { create } from 'zustand';
import { CANVAS_LAYER_ATTR, copyCanvas } from './canvasTransition';

interface LiveSnapshot {
  /** A static copy of the canvas as you left it (see copyCanvas). */
  node: HTMLElement;
  width: number;
  height: number;
}

/**
 * The canvas panel's pictures of canvases you've left in this visit: taken the moment you switch
 * away, so the panel shows exactly where you were (in the editor or as a visitor). They're live
 * DOM, so they follow theme changes. Gone on reload, when the published snapshots show again.
 */
export const useLiveSnapshots = create<Record<string, LiveSnapshot | undefined>>(() => ({}));

/** Pictures the open canvas for the panel, right before switching away from it. */
export function rememberCanvas(slug: string) {
  const layer = document.querySelector<HTMLElement>(`[${CANVAS_LAYER_ATTR}]`);
  if (!layer) return;
  const { width, height } = layer.getBoundingClientRect();
  if (width < 1 || height < 1) return;
  const node = copyCanvas(layer);
  node.style.cssText = `position:absolute;left:0;top:0;width:${width}px;height:${height}px;transform:none;box-shadow:none`;
  useLiveSnapshots.setState({ [slug]: { node, width, height } });
}

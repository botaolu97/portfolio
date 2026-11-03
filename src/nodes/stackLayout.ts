import type { StackItem } from '../store/schema';

/** Tilt per layer, top first: the top print is nearly straight, the ones below fan out. */
const ANGLES = [-2, 7, -6, 10, -9, 5, -11, 4];

/** Each layer down also shifts a little (px per layer), so its edges show past the one above. */
const SHIFT = { x: 5, y: 3 };

/** Prints are drawn this much smaller than the node so their tilted corners stay inside it. */
const INSET = 0.78;

export interface PrintLayout {
  item: StackItem;
  left: number;
  top: number;
  width: number;
  height: number;
  angle: number;
  /** Shift for this layer, in px. */
  dx: number;
  dy: number;
}

/**
 * Lays out a stack's prints inside a `width`×`height` node: each image keeps its aspect ratio,
 * is centred, and gets a fixed tilt by its depth in the pile (so the look never changes between
 * renders). Returned bottom to top, in paint order.
 */
export function layoutPrints(items: StackItem[], width: number, height: number): PrintLayout[] {
  return items.map((item, i) => {
    const depth = items.length - 1 - i;
    const scale = Math.min((width * INSET) / item.width, (height * INSET) / item.height);
    const w = item.width * scale;
    const h = item.height * scale;
    return {
      item,
      left: (width - w) / 2,
      top: (height - h) / 2,
      width: w,
      height: h,
      angle: ANGLES[depth % ANGLES.length],
      dx: depth === 0 ? 0 : (depth % 2 ? 1 : -1) * SHIFT.x * Math.ceil(depth / 2),
      dy: depth * SHIFT.y,
    };
  });
}

/** Columns for the spread-out view: a row for up to 3 images, then a near-square grid. */
export const spreadColumns = (count: number) => (count <= 3 ? count : Math.ceil(Math.sqrt(count)));

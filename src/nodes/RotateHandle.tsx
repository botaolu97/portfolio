import { type PointerEvent, useRef } from 'react';
import styles from './nodes.module.css';

/** Snap step while Shift is held, in degrees. */
const SNAP = 15;

/** Normalizes an angle to -180..180 and rounds it to a tenth of a degree. */
export const normalizeAngle = (deg: number) => {
  const wrapped = ((((deg + 180) % 360) + 360) % 360) - 180;
  return Math.round(wrapped * 10) / 10;
};

/**
 * Round handle above a selected node: drag around the node's centre to rotate it, Shift snaps to
 * 15°, double-click resets to 0°. Focused, the arrow keys turn it by 1° (15° with Shift) and Home
 * straightens it. `center` returns the node's centre on screen.
 */
export function RotateHandle({
  rotation,
  center,
  onRotate,
}: {
  rotation: number;
  center: () => { x: number; y: number };
  onRotate: (deg: number) => void;
}) {
  const start = useRef<{ pointer: number; rotation: number } | null>(null);
  const angleTo = (e: PointerEvent) => {
    const c = center();
    return (Math.atan2(e.clientY - c.y, e.clientX - c.x) * 180) / Math.PI;
  };

  return (
    <div
      className={`${styles.rotateHandle} nodrag`}
      role="slider"
      aria-label="Rotate"
      aria-valuemin={-180}
      aria-valuemax={180}
      aria-valuenow={rotation}
      tabIndex={0}
      title="Drag to rotate (Shift snaps to 15°, double-click resets)"
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { pointer: angleTo(e), rotation };
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        let next = start.current.rotation + angleTo(e) - start.current.pointer;
        if (e.shiftKey) next = Math.round(next / SNAP) * SNAP;
        onRotate(normalizeAngle(next));
      }}
      onPointerUp={() => {
        start.current = null;
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
      // The click that ends a drag must not reach the node: with Shift held it would toggle the
      // note out of the selection.
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        const step = e.shiftKey ? SNAP : 1;
        const delta = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step }[
          e.key
        ];
        if (delta !== undefined) onRotate(normalizeAngle(rotation + delta));
        else if (e.key === 'Home') onRotate(0);
        else return;
        e.preventDefault();
        e.stopPropagation();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onRotate(0);
      }}
    />
  );
}

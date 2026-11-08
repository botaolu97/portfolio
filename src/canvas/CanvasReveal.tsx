import { useStoreApi } from '@xyflow/react';
import { useEffect, useRef } from 'react';
import { SNAPSHOT } from '../app/snapshot';
import { EDITABLE } from '../content/api';
import { useTheme } from '../ui/theme';
import { tokenValues } from '../ui/tokens';

const num = (token: keyof typeof tokenValues) => Number.parseFloat(tokenValues[token]);

/** The reveal's look and feel; the editor gets a smaller, quieter version (see design tokens). */
const SETTINGS = {
  radius: num(EDITABLE ? 'component.canvas-reveal.radius-edit' : 'component.canvas-reveal.radius'),
  symbol: num(
    EDITABLE ? 'component.canvas-reveal.symbol-size-edit' : 'component.canvas-reveal.symbol-size',
  ),
  fadeIn: num('component.canvas-reveal.fade-in'),
  fadeOut: num('component.canvas-reveal.fade-out'),
  follow: num('component.canvas-reveal.follow'),
};
/** Below this zoom the symbols would be specks: the reveal rests. */
const MIN_ZOOM = 0.5;
/** A still pointer lets the symbols settle back into dots after this long. */
const IDLE_MS = 1200;

type Symbol = 'plus' | 'minus' | 'times' | 'divide';
const SYMBOLS: Symbol[] = ['plus', 'minus', 'times', 'divide'];

/** The same symbol at the same grid point, every time: a hidden layer, not random flicker. */
function symbolAt(i: number, j: number): Symbol {
  let h = Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  return SYMBOLS[(h >>> 0) % SYMBOLS.length];
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** "#rrggbb" (what the tokens produce) → [r, g, b]. */
function rgb(hex: string): [number, number, number] {
  const m = hex.trim().match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  return m
    ? ([1, 2, 3].map((k) => Number.parseInt(m[k], 16)) as [number, number, number])
    : [0, 0, 0];
}

/**
 * Around the pointer, the canvas's dots morph into + − × ÷ and back into dots as it moves away:
 * near the edge of the reach a dot just stretches a little, at the pointer it's a full symbol.
 * Drawn on one canvas between the dot grid and the boxes, only for the grid points within reach,
 * and only while something is moving or fading; a still page costs nothing.
 *
 * Mouse only (no hover on touch), off with reduced motion, while dragging, and when zoomed far out.
 */
export function CanvasReveal({ gap, dotSize }: { gap: number; dotSize: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const flow = useStoreApi();
  const theme = useTheme((s) => s.theme);

  // biome-ignore lint/correctness/useExhaustiveDependencies: colors are read again when the theme changes
  useEffect(() => {
    const el = canvas.current;
    const host = flow.getState().domNode;
    if (!el || !host || SNAPSHOT) return;
    const quiet = window.matchMedia('(prefers-reduced-motion: reduce), (hover: none)');
    if (quiet.matches) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;

    const css = getComputedStyle(document.documentElement);
    const canvasColor = css.getPropertyValue('--color-canvas').trim();
    const dot = rgb(css.getPropertyValue('--color-canvas-dot'));
    // In the editor the symbols stay in the dot color; visitors get a slightly stronger tone.
    const full = EDITABLE ? dot : rgb(css.getPropertyValue('--canvas-reveal-color'));

    let width = 0;
    let height = 0;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = host.clientWidth;
      height = host.clientHeight;
      el.width = Math.round(width * dpr);
      el.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const resizer = new ResizeObserver(resize);
    resizer.observe(host);

    let target: { x: number; y: number } | null = null;
    let pos: { x: number; y: number } | null = null;
    let presence = 0;
    let lastMove = 0;
    let lastFrame = 0;
    let frame = 0;

    const draw = (now: number) => {
      const dt = lastFrame ? Math.min(now - lastFrame, 64) : 16.7;
      lastFrame = now;
      const [tx, ty, zoom] = flow.getState().transform;
      const active = target !== null && now - lastMove < IDLE_MS && zoom >= MIN_ZOOM;
      presence = Math.min(
        1,
        Math.max(0, presence + (active ? dt / SETTINGS.fadeIn : -dt / SETTINGS.fadeOut)),
      );
      if (target) {
        if (!pos) pos = { ...target };
        // Trails the pointer softly, at the same pace whatever the frame rate.
        const k = 1 - (1 - SETTINGS.follow) ** (dt / 16.7);
        pos.x += (target.x - pos.x) * k;
        pos.y += (target.y - pos.y) * k;
      }
      ctx.clearRect(0, 0, width, height);
      if (presence <= 0 || !pos) {
        // Fully back to dots: stop drawing until the pointer moves again.
        frame = 0;
        lastFrame = 0;
        if (!target) pos = null;
        return;
      }

      const strength = smoothstep(presence);
      const radius = SETTINGS.radius;
      const step = gap * zoom;
      const offset = dotSize / 2 - gap / 2;
      const dotRadius = (dotSize * zoom) / 2;
      const symbolSize = SETTINGS.symbol * Math.min(Math.max(zoom, 0.75), 1.5);
      const stroke = Math.max(1.1, symbolSize * 0.16);
      // Grid points (in canvas units) whose screen position is within reach of the pointer.
      const iFrom = Math.ceil((pos.x - radius - tx) / step - offset / gap);
      const iTo = Math.floor((pos.x + radius - tx) / step - offset / gap);
      const jFrom = Math.ceil((pos.y - radius - ty) / step - offset / gap);
      const jTo = Math.floor((pos.y + radius - ty) / step - offset / gap);
      ctx.lineCap = 'round';

      for (let i = iFrom; i <= iTo; i++) {
        const x = tx + zoom * (i * gap + offset);
        for (let j = jFrom; j <= jTo; j++) {
          const y = ty + zoom * (j * gap + offset);
          const d = Math.hypot(x - pos.x, y - pos.y) / radius;
          if (d >= 1) continue;
          const f = smoothstep(1 - d) * strength;
          if (f < 0.03) continue;
          // Cover the dot underneath, then draw it morphing: a short round stroke as thick as
          // the dot (which looks like the dot) growing into the symbol.
          ctx.fillStyle = canvasColor;
          ctx.beginPath();
          ctx.arc(x, y, dotRadius + 1, 0, Math.PI * 2);
          ctx.fill();

          const [r, g, b] = [0, 1, 2].map((c) => Math.round(lerp(dot[c], full[c], f)));
          const color = `rgb(${r} ${g} ${b})`;
          const half = lerp(0, symbolSize / 2, f);
          const width = lerp(dotRadius * 2, stroke, f);
          ctx.strokeStyle = color;
          ctx.fillStyle = color;
          ctx.lineWidth = width;
          const symbol = symbolAt(i, j);
          ctx.save();
          ctx.translate(x, y);
          // × turns into place from + as it appears.
          if (symbol === 'times') ctx.rotate((Math.PI / 4) * f);
          ctx.beginPath();
          ctx.moveTo(-half, 0);
          ctx.lineTo(half, 0);
          if (symbol === 'plus' || symbol === 'times') {
            ctx.moveTo(0, -half);
            ctx.lineTo(0, half);
          }
          ctx.stroke();
          if (symbol === 'divide') {
            const dotR = (width / 2) * 1.1 * f;
            for (const sign of [-1, 1]) {
              ctx.beginPath();
              ctx.arc(0, sign * half * 0.75, dotR, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.restore();
        }
      }
      frame = requestAnimationFrame(draw);
    };
    const wake = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      // Dragging (moving boxes, panning, selecting): settle back to dots.
      if (e.buttons) {
        target = null;
      } else {
        const box = host.getBoundingClientRect();
        target = { x: e.clientX - box.left, y: e.clientY - box.top };
        lastMove = performance.now();
      }
      wake();
    };
    const onLeave = () => {
      target = null;
      wake();
    };
    // Panning or zooming moves the grid under a still reveal: redraw in step.
    const unsubscribe = flow.subscribe((state, prev) => {
      if (state.transform !== prev.transform && presence > 0) wake();
    });

    host.addEventListener('pointermove', onMove, { passive: true });
    host.addEventListener('pointerleave', onLeave);
    host.addEventListener('pointerdown', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      resizer.disconnect();
      unsubscribe();
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      host.removeEventListener('pointerdown', onMove);
      ctx.clearRect(0, 0, width, height);
    };
  }, [flow, gap, dotSize, theme]);

  return (
    <canvas
      ref={canvas}
      // Above the dot grid (z-index -1), below the pane and the boxes.
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}

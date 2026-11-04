import type { CSSProperties } from 'react';
import type { TextSize } from '../store/schema';

/** Inline style that scales a text node or note to its size preset (see --_scale in nodes.module.css). */
export const textSizeStyle = (size: TextSize = 'md') =>
  ({ '--_scale': `var(--rich-text-scale-${size})` }) as CSSProperties;

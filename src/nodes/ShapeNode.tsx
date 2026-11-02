import type { NodeProps } from '@xyflow/react';
import { memo } from 'react';
import type { FlowNode } from '../store/mapStore';
import type { NodeDataOf } from '../store/schema';
import { NodeChrome } from './NodeChrome';
import styles from './nodes.module.css';

type ShapeKind = NodeDataOf<'shape'>['shape'];

// Drawn in a 100×100 box and stretched to the node size; strokes stay a constant width.
const SHAPES: Record<ShapeKind, (p: { fill: string; stroke: string }) => React.ReactNode> = {
  rect: (p) => <rect x="0" y="0" width="100" height="100" {...p} />,
  rounded: (p) => <rect x="0" y="0" width="100" height="100" rx="12" ry="18" {...p} />,
  ellipse: (p) => <ellipse cx="50" cy="50" rx="50" ry="50" {...p} />,
  diamond: (p) => <polygon points="50,0 100,50 50,100 0,50" {...p} />,
  triangle: (p) => <polygon points="50,0 100,100 0,100" {...p} />,
  hexagon: (p) => <polygon points="25,0 75,0 100,50 75,100 25,100 0,50" {...p} />,
};

export const ShapeNode = memo(function ShapeNode({
  data,
  selected,
}: NodeProps<Extract<FlowNode, { type: 'shape' }>>) {
  return (
    <div className={styles.shape}>
      <NodeChrome selected={selected} />
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <g
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          style={{ vectorEffect: 'non-scaling-stroke' }}
        >
          {SHAPES[data.shape]({ fill: data.fill, stroke: data.stroke })}
        </g>
      </svg>
      {data.label && <div className={styles.shapeLabel}>{data.label}</div>}
    </div>
  );
});

import type { NodeProps } from '@xyflow/react';
import { memo, useRef } from 'react';
import { EDITABLE } from '../content/api';
import { type FlowNode, useMapStore } from '../store/mapStore';
import type { NodeDataOf } from '../store/schema';
import { NodeChrome } from './NodeChrome';
import styles from './nodes.module.css';
import { RotateHandle } from './RotateHandle';

type ShapeKind = NodeDataOf<'shape'>['shape'];

// Drawn in a 100×100 box and stretched to the node size; strokes stay a constant width.
const SHAPES: Record<ShapeKind, (p: { fill: string; stroke: string }) => React.ReactNode> = {
  rect: (p) => <rect x="0" y="0" width="100" height="100" {...p} />,
  rounded: (p) => <rect x="0" y="0" width="100" height="100" rx="12" ry="18" {...p} />,
  ellipse: (p) => <ellipse cx="50" cy="50" rx="50" ry="50" {...p} />,
  diamond: (p) => <polygon points="50,0 100,50 50,100 0,50" {...p} />,
  triangle: (p) => <polygon points="50,0 100,100 0,100" {...p} />,
  hexagon: (p) => <polygon points="25,0 75,0 100,50 75,100 25,100 0,50" {...p} />,
  // A block arrow pointing right.
  arrow: (p) => (
    <polygon points="0,30 60,30 60,0 100,50 60,100 60,70 0,70" strokeLinejoin="round" {...p} />
  ),
};

export const ShapeNode = memo(function ShapeNode({
  id,
  data,
  selected,
}: NodeProps<Extract<FlowNode, { type: 'shape' }>>) {
  const body = useRef<HTMLDivElement>(null);
  // Resize and connection handles stay on the unrotated box; only the drawing (and label) turns.
  return (
    <div className={styles.shape}>
      <NodeChrome selected={selected} />
      {EDITABLE && selected && (
        <RotateHandle
          rotation={data.rotation}
          center={() => {
            const r = body.current?.getBoundingClientRect();
            return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: 0, y: 0 };
          }}
          onRotate={(rotation) => useMapStore.getState().updateNodeData<'shape'>(id, { rotation })}
        />
      )}
      <div
        ref={body}
        className={styles.shapeBody}
        style={{ transform: data.rotation ? `rotate(${data.rotation}deg)` : undefined }}
      >
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
    </div>
  );
});

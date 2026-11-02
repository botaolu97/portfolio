import type { NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { asset } from '../content/api';
import type { FlowNode } from '../store/mapStore';
import { NodeChrome } from './NodeChrome';
import styles from './nodes.module.css';

export const ImageNode = memo(function ImageNode({
  data,
  selected,
}: NodeProps<Extract<FlowNode, { type: 'image' }>>) {
  return (
    <>
      <NodeChrome selected={selected} keepAspectRatio={data.fit === 'contain'} />
      {data.src ? (
        <img
          className={styles.image}
          src={asset(data.src)}
          alt={data.alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          style={{ objectFit: data.fit }}
        />
      ) : (
        <div className={styles.placeholder}>Drop an image or pick one in the inspector</div>
      )}
    </>
  );
});

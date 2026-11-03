import { type NodeProps, useStore } from '@xyflow/react';
import { memo } from 'react';
import { asset } from '../content/api';
import type { FlowNode } from '../store/mapStore';
import { DEVICES } from '../store/schema';
import { tokenValues } from '../ui/tokens';
import { NodeChrome } from './NodeChrome';
import styles from './nodes.module.css';

const BAR_HEIGHT = Number.parseFloat(tokenValues['component.demo.bar-height']);
/** Below this zoom a live page is unreadable anyway, so show the poster instead of an iframe. */
const LIVE_MIN_ZOOM = 0.35;

/**
 * A live demo. The page is interactive right away; the title bar is the handle for
 * selecting and dragging the node, since the iframe keeps pointer input for itself.
 */
export const DemoNode = memo(function DemoNode({
  data,
  selected,
  width = 640,
  height = 440,
}: NodeProps<Extract<FlowNode, { type: 'demo' }>>) {
  const live = useStore((s) => s.transform[2] >= LIVE_MIN_ZOOM);

  const deviceWidth = DEVICES[data.device];
  const scale = width / deviceWidth;
  const bodyHeight = Math.max(0, height - BAR_HEIGHT);
  const ready = data.demoId !== 'pending';

  let body: React.ReactNode;
  if (!ready) {
    body = <div className={styles.placeholder}>Upload demo files in the inspector</div>;
  } else if (live) {
    body = (
      <iframe
        title={data.title}
        src={asset(`content/demos/${data.demoId}/${data.entry}`)}
        // No allow-same-origin: the demo runs in an opaque origin and can't touch Mubu.
        sandbox="allow-scripts allow-forms allow-modals"
        loading="lazy"
        style={{
          width: deviceWidth,
          height: bodyHeight / scale,
          transform: `scale(${scale})`,
        }}
      />
    );
  } else if (data.poster) {
    body = <img src={asset(data.poster)} alt={data.title} loading="lazy" draggable={false} />;
  } else {
    body = <div className={styles.placeholder}>Zoom in to run this demo</div>;
  }

  return (
    <div className={styles.demo}>
      <NodeChrome selected={selected} minWidth={200} minHeight={150} />
      <div className={styles.demoBar}>
        <span className={styles.dots} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className={styles.demoTitle}>{data.title}</span>
      </div>
      <div className={styles.demoBody}>{body}</div>
    </div>
  );
});

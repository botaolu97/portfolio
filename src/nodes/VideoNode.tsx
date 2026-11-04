import type { NodeProps } from '@xyflow/react';
import { memo, useMemo, useState } from 'react';
import { asset, EDITABLE } from '../content/api';
import type { FlowNode } from '../store/mapStore';
import { NodeChrome } from './NodeChrome';
import styles from './nodes.module.css';
import { parseVideoSource } from './videoSource';

export const VideoNode = memo(function VideoNode({
  data,
  selected,
}: NodeProps<Extract<FlowNode, { type: 'video' }>>) {
  const source = useMemo(() => parseVideoSource(data.src), [data.src]);
  // Embeds stay a lightweight thumbnail until clicked, so a map full of videos loads fast.
  const [playing, setPlaying] = useState(false);

  // View mode: lifts on hover (see .lift).
  const lift = EDITABLE ? '' : styles.lift;

  // The player takes the whole box and needs its own drags (seeking), so in the editor a strip
  // along the top is the handle for moving the node. It sits clear of the controls at the bottom.
  const dragStrip = EDITABLE ? (
    <div className={styles.dragStrip} title="Drag to move" aria-hidden="true">
      <svg className={styles.grip} width="18" height="8" viewBox="0 0 18 8" aria-hidden="true">
        {[3, 9, 15].flatMap((x) =>
          [2, 6].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" fill="currentColor" />),
        )}
      </svg>
    </div>
  ) : null;

  let body: React.ReactNode;
  if (source.kind === 'none') {
    body = <div className={styles.placeholder}>Drop a video file or paste a YouTube/Vimeo URL</div>;
  } else if (source.kind === 'file') {
    body = (
      <div className={`${styles.video} ${lift}`}>
        {dragStrip}
        <video
          className="nodrag"
          src={asset(source.src)}
          poster={data.poster ? asset(data.poster) : undefined}
          controls
          preload="metadata"
          playsInline
        />
      </div>
    );
  } else if (playing) {
    body = (
      <div className={`${styles.video} ${lift}`}>
        {dragStrip}
        <iframe
          className="nodrag nowheel"
          src={source.embed}
          title="Video"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
        />
      </div>
    );
  } else {
    const thumb = data.poster
      ? asset(data.poster)
      : source.kind === 'youtube'
        ? source.thumbnail
        : undefined;
    body = (
      <div className={`${styles.video} ${lift}`}>
        {thumb && <img src={thumb} alt="" loading="lazy" decoding="async" draggable={false} />}
        <button
          type="button"
          className={`${styles.play} nodrag`}
          aria-label="Play video"
          onClick={() => setPlaying(true)}
        >
          ▶
        </button>
      </div>
    );
  }

  return (
    <>
      <NodeChrome selected={selected} minWidth={160} minHeight={90} />
      {body}
    </>
  );
});

import type { NodeProps } from '@xyflow/react';
import { memo, useMemo, useState } from 'react';
import { asset } from '../content/api';
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

  let body: React.ReactNode;
  if (source.kind === 'none') {
    body = <div className={styles.placeholder}>Drop a video file or paste a YouTube/Vimeo URL</div>;
  } else if (source.kind === 'file') {
    body = (
      <div className={styles.video}>
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
      <div className={`${styles.video} nodrag nowheel`}>
        <iframe
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
      <div className={styles.video}>
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

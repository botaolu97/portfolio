import type { NodeProps } from '@xyflow/react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { asset, EDITABLE } from '../content/api';
import type { FlowNode } from '../store/mapStore';
import { Spinner } from '../ui/Spinner';
import { useMediaLoaded } from '../ui/useMediaLoaded';
import { NodeChrome } from './NodeChrome';
import styles from './nodes.module.css';
import { VideoViewer } from './VideoViewer';
import { parseVideoSource } from './videoSource';

export const VideoNode = memo(function VideoNode({
  data,
  selected,
  width,
  height,
}: NodeProps<Extract<FlowNode, { type: 'video' }>>) {
  const source = useMemo(() => parseVideoSource(data.src), [data.src]);
  // Embeds stay a lightweight thumbnail until clicked, so a map full of videos loads fast.
  const [playing, setPlaying] = useState(false);
  // Enlarged in the canvas area (VideoViewer) instead of the browser's fullscreen, which would
  // cover the canvas panel; `at` is where an uploaded video carries on from.
  const [expanded, setExpanded] = useState<{ at: number } | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  // A spinner circles until the video's first details (or the thumbnail, or the player) load.
  const media = useMediaLoaded<HTMLVideoElement>(data.src);
  const thumbLoaded = useMediaLoaded<HTMLImageElement>(data.poster ?? data.src);
  const embedLoaded = useMediaLoaded<HTMLIFrameElement>(playing ? data.src : undefined);
  const videoRef = (el: HTMLVideoElement | null) => {
    video.current = el;
    media.ref(el);
  };

  const expand = () => {
    const v = video.current;
    const at = v?.currentTime ?? 0;
    v?.pause();
    // An embed playing in the box stops (back to its thumbnail) so it doesn't play twice.
    setPlaying(false);
    setExpanded({ at });
  };
  const expandRef = useRef(expand);
  expandRef.current = expand;

  // Browsers that still offer their own fullscreen (Safari ignores controlsList): leave it right
  // away and enlarge in the canvas area instead.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const onFullscreen = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      if ((document.fullscreenElement ?? doc.webkitFullscreenElement) !== v) return;
      void (document.exitFullscreen?.() ?? Promise.resolve()).catch(() => undefined);
      expandRef.current();
    };
    const onWebkitBegin = () => {
      (v as HTMLVideoElement & { webkitExitFullscreen?: () => void }).webkitExitFullscreen?.();
      expandRef.current();
    };
    document.addEventListener('fullscreenchange', onFullscreen);
    document.addEventListener('webkitfullscreenchange', onFullscreen);
    v.addEventListener('webkitbeginfullscreen', onWebkitBegin);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreen);
      document.removeEventListener('webkitfullscreenchange', onFullscreen);
      v.removeEventListener('webkitbeginfullscreen', onWebkitBegin);
    };
  }, [source.kind]);

  const expandButton =
    source.kind === 'none' ? null : (
      <button
        type="button"
        className={`${styles.expand} nodrag`}
        aria-label="Enlarge video"
        title="Enlarge"
        onClick={(e) => {
          e.stopPropagation();
          expand();
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    );

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
        {expandButton}
        {!media.loaded && <Spinner />}
        <video
          ref={videoRef}
          onLoadedMetadata={media.done}
          onError={media.done}
          className="nodrag"
          src={asset(source.src)}
          poster={data.poster ? asset(data.poster) : undefined}
          controls
          // Fullscreen would cover the canvas panel: the enlarge button opens it in the canvas area.
          controlsList="nofullscreen"
          disablePictureInPicture
          preload="metadata"
          playsInline
        />
      </div>
    );
  } else if (playing) {
    body = (
      <div className={`${styles.video} ${lift}`}>
        {dragStrip}
        {expandButton}
        {/* No fullscreen permission: the player's own fullscreen would cover the canvas panel. */}
        {!embedLoaded.loaded && <Spinner />}
        <iframe
          ref={embedLoaded.ref}
          onLoad={embedLoaded.done}
          className="nodrag nowheel"
          src={source.embed}
          title="Video"
          allow="autoplay; picture-in-picture; encrypted-media"
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
        {expandButton}
        {thumb && !thumbLoaded.loaded && <Spinner />}
        {thumb && (
          <img
            ref={thumbLoaded.ref}
            onLoad={thumbLoaded.done}
            onError={thumbLoaded.done}
            src={thumb}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        )}
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
      {expanded && source.kind !== 'none' && (
        <VideoViewer
          source={source}
          poster={data.poster}
          startAt={expanded.at}
          aspect={width && height ? width / height : 16 / 9}
          onClose={(time) => {
            if (video.current && time !== undefined) video.current.currentTime = time;
            setExpanded(null);
          }}
        />
      )}
    </>
  );
});

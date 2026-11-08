import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { overlayRoot } from '../app/overlayRoot';
import { asset } from '../content/api';
import { Spinner } from '../ui/Spinner';
import { useMediaLoaded } from '../ui/useMediaLoaded';
import styles from './VideoViewer.module.css';
import type { VideoSource } from './videoSource';

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

/**
 * A video enlarged to fill the canvas area (never the canvas panel), in place of the browser's
 * own fullscreen. An uploaded video carries on from where it was; an embed starts playing.
 * Esc, the close button or a click outside the video closes it and reports where playback got to.
 */
export function VideoViewer({
  source,
  poster,
  startAt = 0,
  aspect,
  onClose,
}: {
  source: Exclude<VideoSource, { kind: 'none' }>;
  poster?: string;
  startAt?: number;
  /** Width / height of the player. */
  aspect: number;
  onClose: (time?: number) => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  // Circles until the video can play (or the embedded player has loaded).
  const ready = useMediaLoaded<HTMLIFrameElement>(
    source.kind === 'file' ? undefined : source.embed,
  );
  const [canPlay, setCanPlay] = useState(false);
  const close = useRef(() => onClose(video.current?.currentTime));
  close.current = () => onClose(video.current?.currentTime);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close.current();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      previous?.focus?.({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <div
      ref={dialog}
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Video"
      tabIndex={-1}
      // React bubbles portal events up to the video node; keep them here.
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) close.current();
      }}
      onDoubleClick={stop}
      onPointerDown={stop}
      onContextMenu={stop}
      onKeyDown={stop}
      onWheel={stop}
    >
      <div className={styles.player} style={{ '--_aspect': aspect } as React.CSSProperties}>
        {(source.kind === 'file' ? !canPlay : !ready.loaded) && <Spinner />}
        {source.kind === 'file' ? (
          // biome-ignore lint/a11y/useMediaCaption: uploaded screen recordings have no captions
          <video
            ref={video}
            src={asset(source.src)}
            poster={poster ? asset(poster) : undefined}
            controls
            controlsList="nofullscreen"
            disablePictureInPicture
            autoPlay
            playsInline
            onLoadedMetadata={(e) => {
              if (startAt > 0) e.currentTarget.currentTime = startAt;
            }}
            onCanPlay={() => setCanPlay(true)}
            onError={() => setCanPlay(true)}
          />
        ) : (
          <iframe
            ref={ready.ref}
            onLoad={ready.done}
            src={source.embed}
            title="Video"
            allow="autoplay; picture-in-picture; encrypted-media"
          />
        )}
      </div>
      <button
        type="button"
        className={styles.close}
        aria-label="Close video"
        onClick={() => close.current()}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M4 4l8 8M12 4l-8 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>,
    overlayRoot(),
  );
}

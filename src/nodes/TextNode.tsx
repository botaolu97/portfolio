import type { NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { EDITABLE } from '../content/api';
import type { FlowNode } from '../store/mapStore';
import { NodeChrome } from './NodeChrome';
import styles from './nodes.module.css';
import { withLinkIcons } from './richLinks';
import { TextReader } from './TextReader';
import { textSizeStyle } from './textSize';
import { useReader } from './useReader';

/**
 * A text box. On the canvas it only shows the text (clipped, no scrollbar); it opens into the
 * full-screen reader on click (visitors) or double-click (editor), and in the editor the text is
 * edited there.
 */
export const TextNode = memo(function TextNode({
  id,
  data,
  selected,
}: NodeProps<Extract<FlowNode, { type: 'text' }>>) {
  const reader = useReader(id);
  const transparent = data.background === 'transparent';
  const style = {
    ...textSizeStyle(data.size),
    ...(data.background && !transparent ? { background: data.background } : {}),
  };
  const className = `${styles.text} ${styles.rich} ${styles.richStatic} ${styles.opensReader} ${EDITABLE ? '' : styles.lift} ${transparent ? styles.transparent : ''}`;

  return (
    <>
      <NodeChrome selected={selected} />
      <div
        ref={reader.box}
        className={className}
        style={style}
        data-landing={reader.landing || undefined}
        onClick={reader.onClick}
        onDoubleClick={reader.onDoubleClick}
        onKeyDown={reader.onKeyDown}
        onPointerLeave={reader.onPointerLeave}
        // Authored by the site owner in edit mode, never by visitors.
        dangerouslySetInnerHTML={{ __html: withLinkIcons(data.html) }}
      />
      {reader.reading && reader.box.current && (
        <TextReader
          html={data.html}
          nodeId={id}
          editable={EDITABLE}
          background={
            data.background && !transparent
              ? data.background
              : `var(--color-${transparent ? 'canvas' : 'surface'})`
          }
          size={data.size}
          source={reader.box.current}
          zoom={reader.zoom()}
          onClosing={reader.closing}
          onClosed={reader.close}
        />
      )}
    </>
  );
});

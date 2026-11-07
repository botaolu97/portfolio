import type { NodeProps } from '@xyflow/react';
import { lazy, memo, Suspense, useRef } from 'react';
import { EDITABLE } from '../content/api';
import { type FlowNode, useMapStore } from '../store/mapStore';
import { useUiStore } from '../store/uiStore';
import { NodeChrome } from './NodeChrome';
import styles from './nodes.module.css';
import { RotateHandle } from './RotateHandle';
import { withLinkIcons } from './richLinks';
import { textSizeStyle } from './textSize';

// Same editor as text nodes; checked inline so the production build drops it.
const RichTextEditor = import.meta.env.DEV ? lazy(() => import('../editor/RichTextEditor')) : null;

/** A sticky note with rich text. Double-click to write (edit mode). */
export const NoteNode = memo(function NoteNode({
  id,
  data,
  selected,
}: NodeProps<Extract<FlowNode, { type: 'note' }>>) {
  const editing = useUiStore((s) => s.editingTextId === id);
  const setEditing = useUiStore((s) => s.setEditingText);
  const empty = !data.html || data.html === '<p></p>';
  const paper = useRef<HTMLDivElement>(null);

  let body: React.ReactNode;
  if (RichTextEditor && editing) {
    body = (
      <div className={`${styles.noteText} ${styles.rich} nodrag nowheel`}>
        <Suspense fallback={null}>
          <RichTextEditor id={id} html={data.html} onDone={() => setEditing(null)} />
        </Suspense>
      </div>
    );
  } else if (empty) {
    body = (
      <div className={`${styles.noteText} ${styles.notePlaceholder}`}>
        {EDITABLE ? 'Double-click to write' : ''}
      </div>
    );
  } else {
    body = (
      <div
        className={`${styles.noteText} ${styles.rich} ${styles.richStatic}`}
        // Authored by the site owner in edit mode, never by visitors.
        dangerouslySetInnerHTML={{ __html: withLinkIcons(data.html) }}
      />
    );
  }

  // Resize and connection handles stay on the unrotated box; only the paper turns.
  return (
    <>
      <NodeChrome selected={selected} minWidth={80} minHeight={60} />
      {EDITABLE && selected && (
        <RotateHandle
          rotation={data.rotation}
          center={() => {
            const r = paper.current?.getBoundingClientRect();
            return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: 0, y: 0 };
          }}
          onRotate={(rotation) => useMapStore.getState().updateNodeData<'note'>(id, { rotation })}
        />
      )}
      <div
        ref={paper}
        className={styles.note}
        style={{
          ...textSizeStyle(data.size),
          background: `var(--color-note-${data.color})`,
          transform: data.rotation ? `rotate(${data.rotation}deg)` : undefined,
        }}
        onDoubleClick={EDITABLE ? () => setEditing(id) : undefined}
      >
        {body}
      </div>
    </>
  );
});

import type { NodeProps } from '@xyflow/react';
import { lazy, memo, Suspense } from 'react';
import { EDITABLE } from '../content/api';
import type { FlowNode } from '../store/mapStore';
import { useUiStore } from '../store/uiStore';
import { NodeChrome } from './NodeChrome';
import styles from './nodes.module.css';

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
        dangerouslySetInnerHTML={{ __html: data.html }}
      />
    );
  }

  return (
    <div
      className={styles.note}
      style={{ background: `var(--color-note-${data.color})` }}
      onDoubleClick={EDITABLE ? () => setEditing(id) : undefined}
    >
      <NodeChrome selected={selected} minWidth={80} minHeight={60} />
      {body}
    </div>
  );
});

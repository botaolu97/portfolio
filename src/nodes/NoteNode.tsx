import type { NodeProps } from '@xyflow/react';
import { memo, useEffect, useRef } from 'react';
import { EDITABLE } from '../content/api';
import { type FlowNode, useMapStore } from '../store/mapStore';
import { useUiStore } from '../store/uiStore';
import { NodeChrome } from './NodeChrome';
import styles from './nodes.module.css';

/** A sticky note. Double-click to write (edit mode); the text is plain and keeps line breaks. */
export const NoteNode = memo(function NoteNode({
  id,
  data,
  selected,
}: NodeProps<Extract<FlowNode, { type: 'note' }>>) {
  const editing = useUiStore((s) => EDITABLE && s.editingTextId === id);
  const setEditing = useUiStore((s) => s.setEditingText);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing || !input.current) return;
    input.current.focus();
    input.current.setSelectionRange(input.current.value.length, input.current.value.length);
  }, [editing]);

  return (
    <div
      className={styles.note}
      style={{ background: `var(--color-note-${data.color})` }}
      onDoubleClick={EDITABLE ? () => setEditing(id) : undefined}
    >
      <NodeChrome selected={selected} minWidth={80} minHeight={60} />
      {editing ? (
        <textarea
          ref={input}
          className={`${styles.noteText} ${styles.noteInput} nodrag nowheel`}
          value={data.text}
          placeholder="Write something…"
          aria-label="Note text"
          onChange={(e) =>
            useMapStore.getState().updateNodeData<'note'>(id, { text: e.target.value })
          }
          onBlur={() => setEditing(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(null);
          }}
        />
      ) : (
        <div className={`${styles.noteText} ${data.text ? '' : styles.notePlaceholder}`}>
          {data.text || (EDITABLE ? 'Double-click to write' : '')}
        </div>
      )}
    </div>
  );
});

import type { NodeProps } from '@xyflow/react';
import { type CSSProperties, memo, useEffect, useRef } from 'react';
import { EDITABLE } from '../content/api';
import { type FlowNode, useMapStore } from '../store/mapStore';
import type { LabelFont, NodeDataOf } from '../store/schema';
import { useUiStore } from '../store/uiStore';
import { NodeChrome } from './NodeChrome';
import styles from './nodes.module.css';

const FONT_FAMILIES: Record<LabelFont, string> = {
  fasthand: 'var(--font-family-fasthand)',
  caveat: 'var(--font-family-caveat)',
  sans: 'var(--font-family-sans)',
  serif: 'var(--font-family-serif)',
  mono: 'var(--font-family-mono)',
};

export const labelStyle = (data: NodeDataOf<'label'>): CSSProperties => ({
  fontFamily: FONT_FAMILIES[data.font],
  fontSize: data.size,
  fontWeight: data.weight,
});

/**
 * Text with no box, sized to its content (change the font size instead of resizing). In the
 * editor, double-click to type: Enter adds a line, Esc or a click elsewhere finishes.
 */
export const LabelNode = memo(function LabelNode({
  id,
  data,
  selected,
}: NodeProps<Extract<FlowNode, { type: 'label' }>>) {
  const editing = useUiStore((s) => EDITABLE && s.editingTextId === id);
  const setEditing = useUiStore((s) => s.setEditingText);
  const input = useRef<HTMLDivElement>(null);

  // Fill the editable text once and put the caret at the end; React doesn't own its contents.
  useEffect(() => {
    const el = input.current;
    if (!editing || !el) return;
    el.textContent =
      useMapStore
        .getState()
        .nodes.find(
          (n): n is Extract<FlowNode, { type: 'label' }> => n.id === id && n.type === 'label',
        )?.data.text ?? '';
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  }, [editing, id]);

  return (
    <>
      <NodeChrome selected={selected} resizable={false} />
      {editing ? (
        // A content-editable div rather than <textarea>, so the label keeps sizing to its text.
        // biome-ignore lint/a11y/useSemanticElements: textarea can't size itself to content
        <div
          ref={input}
          role="textbox"
          aria-multiline="true"
          tabIndex={0}
          className={`${styles.label} ${styles.labelEditing} nodrag nowheel`}
          style={labelStyle(data)}
          contentEditable="plaintext-only"
          suppressContentEditableWarning
          aria-label="Label text"
          onInput={(e) =>
            useMapStore.getState().updateNodeData<'label'>(id, {
              // innerText, not textContent: browsers may insert line breaks as <br> or <div>.
              // biome-ignore lint/performance/useDomNodeTextContent: line breaks matter here
              text: e.currentTarget.innerText,
            })
          }
          onBlur={() => setEditing(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setEditing(null);
            }
          }}
        />
      ) : (
        <div
          className={`${styles.label} ${data.text ? '' : styles.labelEmpty}`}
          style={labelStyle(data)}
          onDoubleClick={EDITABLE ? () => setEditing(id) : undefined}
        >
          {data.text || (EDITABLE ? 'Label' : '')}
        </div>
      )}
    </>
  );
});

import type { NodeProps } from '@xyflow/react';
import { lazy, memo, Suspense } from 'react';
import { EDITABLE } from '../content/api';
import type { FlowNode } from '../store/mapStore';
import { useUiStore } from '../store/uiStore';
import { NodeChrome } from './NodeChrome';
import styles from './nodes.module.css';

// Tiptap is only needed to edit; the published site renders the stored HTML.
// Checked inline (not via EDITABLE) so the production build drops the chunk entirely.
const RichTextEditor = import.meta.env.DEV ? lazy(() => import('../editor/RichTextEditor')) : null;

export const TextNode = memo(function TextNode({
  id,
  data,
  selected,
}: NodeProps<Extract<FlowNode, { type: 'text' }>>) {
  const editing = useUiStore((s) => s.editingTextId === id);
  const setEditingText = useUiStore((s) => s.setEditingText);
  const transparent = data.background === 'transparent';
  const style = data.background && !transparent ? { background: data.background } : undefined;
  const className = `${styles.text} ${styles.rich} ${transparent ? styles.transparent : ''}`;

  if (RichTextEditor && editing) {
    return (
      <>
        <NodeChrome selected={selected} />
        <div className={`${className} nodrag nowheel`} style={style}>
          <Suspense fallback={null}>
            <RichTextEditor id={id} html={data.html} onDone={() => setEditingText(null)} />
          </Suspense>
        </div>
      </>
    );
  }

  return (
    <>
      <NodeChrome selected={selected} />
      <div
        className={`${className} ${styles.richStatic}`}
        style={style}
        onDoubleClick={EDITABLE ? () => setEditingText(id) : undefined}
        // Authored by the site owner in edit mode, never by visitors.
        dangerouslySetInnerHTML={{ __html: data.html }}
      />
    </>
  );
});

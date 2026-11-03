import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect } from 'react';
import { useMapStore } from '../store/mapStore';
import { richTextExtensions } from './richTextExtensions';

/** Inline Tiptap editor for a text node or note; writes HTML back to the store as you type. */
export default function RichTextEditor({
  id,
  html,
  onDone,
}: {
  id: string;
  html: string;
  onDone: () => void;
}) {
  const editor = useEditor({
    extensions: richTextExtensions,
    content: html,
    autofocus: 'end',
    onUpdate: ({ editor }) =>
      useMapStore.getState().updateNodeData<'text' | 'note'>(id, { html: editor.getHTML() }),
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onDone]);

  return <EditorContent editor={editor} />;
}

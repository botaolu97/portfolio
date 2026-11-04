import { useStoreApi } from '@xyflow/react';
import { type KeyboardEvent, type MouseEvent, useEffect, useRef, useState } from 'react';
import { EDITABLE } from '../content/api';
import { useMapStore } from '../store/mapStore';
import { useUiStore } from '../store/uiStore';

/**
 * Full-screen reader state for a text box. Visitors open it with a click (links inside the text
 * still work); in the editor, with a double-click or from the inspector, and the text is edited there.
 */
export function useReader(id: string) {
  const box = useRef<HTMLDivElement>(null);
  const reading = useUiStore((s) => s.readerNodeId === id);
  const setReader = useUiStore((s) => s.setReader);
  const flow = useStoreApi();
  // Right after zooming back, the pointer is still over the box: hold off the hover outline until
  // it leaves, so the box lands at exactly its own size.
  const [landing, setLanding] = useState(false);

  // The click that opens the reader also selects the box; drop that so no selection ring waits
  // around it when the reader zooms back.
  useEffect(() => {
    if (!reading || EDITABLE) return;
    const { nodes } = useMapStore.getState();
    if (nodes.some((n) => n.id === id && n.selected)) {
      useMapStore.setState({
        nodes: nodes.map((n) => (n.id === id ? { ...n, selected: false } : n)),
      });
    }
  }, [reading, id]);

  const onClick = EDITABLE
    ? undefined
    : (e: MouseEvent) => {
        if ((e.target as Element).closest('a')) return;
        setReader(id);
      };

  const onKeyDown = EDITABLE
    ? undefined
    : (e: KeyboardEvent) => {
        if (e.key === 'Enter') setReader(id);
      };

  // In the editor a click selects (to move or resize); a double-click opens it to edit.
  const onDoubleClick = EDITABLE ? () => setReader(id) : undefined;

  return {
    box,
    reading: reading && !!box.current,
    landing,
    onClick,
    onDoubleClick,
    onKeyDown,
    onPointerLeave: () => setLanding(false),
    /** Canvas zoom right now (read once, so nodes don't re-render while zooming). */
    zoom: () => flow.getState().transform[2],
    /** The zoom back has started: the canvas UI fades back in alongside it. */
    closing: () => useUiStore.getState().setReaderOpen(false),
    close: () => {
      setLanding(true);
      setReader(null);
    },
  };
}

import { useEffect, useRef } from 'react';
import { type FlowEdge, type FlowNode, useMapStore } from '../store/mapStore';
import { imagesFromClipboard } from './fileDrop';

/** Written to the system clipboard on copy, so a later paste knows to paste nodes, not an old image. */
const NODES_MARKER = 'application/x-mubu-nodes';

let clipboard: { nodes: FlowNode[]; edges: FlowEdge[] } | null = null;

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

/**
 * Editor keyboard shortcuts. Delete/Backspace is handled by React Flow itself.
 * Copy and paste use the real clipboard events: pasting an image (PNG, JPG, SVG file or SVG
 * markup) adds it to the canvas; pasting after copying nodes duplicates them.
 */
export function useShortcuts(onPasteImages: (files: File[]) => void) {
  const pasteImages = useRef(onPasteImages);
  pasteImages.current = onPasteImages;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || isTyping(e.target)) return;
      const key = e.key.toLowerCase();
      const store = useMapStore.getState();
      const history = useMapStore.temporal.getState();

      if (key === 'z' && !e.shiftKey) history.undo();
      else if ((key === 'z' && e.shiftKey) || key === 'y') history.redo();
      else if (key === 'd') {
        store.insertClones(
          store.nodes.filter((n) => n.selected),
          store.edges,
          24,
        );
      } else if (key === 'a') {
        useMapStore.setState({
          nodes: store.nodes.map((n) => ({ ...n, selected: true })),
          edges: store.edges.map((ed) => ({ ...ed, selected: true })),
        });
      } else return;
      e.preventDefault();
    };

    const onCopy = (e: ClipboardEvent) => {
      if (isTyping(e.target) || !e.clipboardData) return;
      const { nodes, edges } = useMapStore.getState();
      const selected = nodes.filter((n) => n.selected);
      if (selected.length === 0) return;
      clipboard = { nodes: selected, edges };
      e.clipboardData.setData('text/plain', NODES_MARKER);
      e.preventDefault();
    };

    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target) || !e.clipboardData) return;
      const images = imagesFromClipboard(e.clipboardData);
      if (images.length > 0) {
        e.preventDefault();
        pasteImages.current(images);
      } else if (clipboard && e.clipboardData.getData('text/plain') === NODES_MARKER) {
        e.preventDefault();
        useMapStore.getState().insertClones(clipboard.nodes, clipboard.edges, 32);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
    };
  }, []);
}

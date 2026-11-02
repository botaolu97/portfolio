import { useEffect } from 'react';
import { type FlowEdge, type FlowNode, useMapStore } from '../store/mapStore';

let clipboard: { nodes: FlowNode[]; edges: FlowEdge[] } | null = null;

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

/** Editor keyboard shortcuts. Delete/Backspace is handled by React Flow itself. */
export function useShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || isTyping(e.target)) return;
      const key = e.key.toLowerCase();
      const store = useMapStore.getState();
      const history = useMapStore.temporal.getState();
      const selection = () => store.nodes.filter((n) => n.selected);

      if (key === 'z' && !e.shiftKey) history.undo();
      else if ((key === 'z' && e.shiftKey) || key === 'y') history.redo();
      else if (key === 'c') clipboard = { nodes: selection(), edges: store.edges };
      else if (key === 'v' && clipboard) store.insertClones(clipboard.nodes, clipboard.edges, 32);
      else if (key === 'd') store.insertClones(selection(), store.edges, 24);
      else if (key === 'a') {
        useMapStore.setState({
          nodes: store.nodes.map((n) => ({ ...n, selected: true })),
          edges: store.edges.map((ed) => ({ ...ed, selected: true })),
        });
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}

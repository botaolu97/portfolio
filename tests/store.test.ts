import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cloneSubgraph,
  type FlowEdge,
  type FlowNode,
  toDoc,
  useMapStore,
} from '../src/store/mapStore';
import { MAP_VERSION } from '../src/store/schema';

const history = () => useMapStore.temporal.getState();

beforeEach(() => {
  vi.useFakeTimers();
  useMapStore.getState().load('test', { version: MAP_VERSION, title: 'T', nodes: [], edges: [] });
});

afterEach(() => {
  // Let the history debounce settle so the next test starts with a fresh burst.
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe('mapStore', () => {
  it('adds a node with defaults and selects only it', () => {
    const a = useMapStore.getState().addNode('shape', { x: 0, y: 0 });
    vi.advanceTimersByTime(500);
    const b = useMapStore.getState().addNode('text', { x: 10, y: 10 });
    const { nodes } = useMapStore.getState();
    expect(nodes.map((n) => [n.id, n.selected])).toEqual([
      [a, false],
      [b, true],
    ]);
    expect(nodes[1]).toMatchObject({ type: 'text', width: 240, height: 120 });
  });

  it('undoes and redoes edits', () => {
    useMapStore.getState().addNode('shape', { x: 0, y: 0 });
    vi.advanceTimersByTime(500);
    expect(useMapStore.getState().nodes).toHaveLength(1);
    history().undo();
    expect(useMapStore.getState().nodes).toHaveLength(0);
    history().redo();
    expect(useMapStore.getState().nodes).toHaveLength(1);
  });

  it('merges a burst of changes into one undo step', () => {
    const id = useMapStore.getState().addNode('shape', { x: 0, y: 0 });
    vi.advanceTimersByTime(500);
    for (let x = 1; x <= 10; x++) {
      useMapStore.getState().onNodesChange([{ type: 'position', id, position: { x, y: 0 } }]);
      vi.advanceTimersByTime(16);
    }
    vi.advanceTimersByTime(500);
    history().undo();
    expect(useMapStore.getState().nodes[0].position).toEqual({ x: 0, y: 0 });
  });

  it('does not record selection changes in history', () => {
    const id = useMapStore.getState().addNode('shape', { x: 0, y: 0 });
    vi.advanceTimersByTime(500);
    const steps = history().pastStates.length;
    useMapStore.getState().onNodesChange([{ type: 'select', id, selected: false }]);
    useMapStore.getState().onNodesChange([{ type: 'select', id, selected: true }]);
    expect(history().pastStates.length).toBe(steps);
  });

  it('serializes without runtime fields', () => {
    useMapStore.getState().addNode('shape', { x: 1.4, y: 2.6 });
    const doc = toDoc(useMapStore.getState());
    expect(doc.nodes[0]).not.toHaveProperty('selected');
    expect(doc.nodes[0].position).toEqual({ x: 1, y: 3 });
  });
});

describe('cloneSubgraph', () => {
  it('gives clones new ids and keeps only internal edges', () => {
    const node = (id: string) =>
      ({
        id,
        type: 'shape',
        position: { x: 0, y: 0 },
        data: { shape: 'rect', fill: '#fff', stroke: '#000', label: '' },
      }) as FlowNode;
    const edges: FlowEdge[] = [
      { id: 'ab', source: 'a', target: 'b' },
      { id: 'bc', source: 'b', target: 'c' },
    ];
    const out = cloneSubgraph([node('a'), node('b')], edges, 20);
    expect(out.nodes.map((n) => n.id)).not.toContain('a');
    expect(out.nodes[0].position).toEqual({ x: 20, y: 20 });
    expect(out.edges).toHaveLength(1);
    expect(out.edges[0]).toMatchObject({ source: out.nodes[0].id, target: out.nodes[1].id });
  });
});

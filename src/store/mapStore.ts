import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type XYPosition,
} from '@xyflow/react';
import { temporal } from 'zundo';
import { create } from 'zustand';
import { NODE_DEFAULTS } from './defaults';
import {
  MAP_VERSION,
  type MapDoc,
  type MapEdge,
  type MapNode,
  type NodeDataOf,
  type NodeType,
} from './schema';

export type FlowNode = { [T in NodeType]: Node<NodeDataOf<T>, T> }[NodeType];
export type FlowEdge = Edge & Pick<MapEdge, 'type'>;

export interface MapState {
  slug: string | null;
  title: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  load: (slug: string, doc: MapDoc) => void;
  setTitle: (title: string) => void;
  onNodesChange: (changes: NodeChange<FlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: <T extends NodeType>(
    type: T,
    position: XYPosition,
    overrides?: { data?: Partial<NodeDataOf<T>>; width?: number; height?: number },
  ) => string;
  updateNodeData: <T extends NodeType>(id: string, patch: Partial<NodeDataOf<T>>) => void;
  updateEdge: (id: string, patch: Partial<Pick<FlowEdge, 'label' | 'type' | 'animated'>>) => void;
  insertClones: (nodes: FlowNode[], edges: FlowEdge[], offset: number) => void;
}

export const newId = () => crypto.randomUUID().slice(0, 8);

const round = (n: number) => Math.round(n);

/** The persistent part of a node: drops React Flow's runtime fields (selected, measured, …). */
function toMapNode(node: FlowNode): MapNode {
  const out = {
    id: node.id,
    type: node.type,
    position: { x: round(node.position.x), y: round(node.position.y) },
    data: node.data,
  } as MapNode;
  if (node.width) out.width = round(node.width);
  if (node.height) out.height = round(node.height);
  if (node.zIndex !== undefined) out.zIndex = node.zIndex;
  return out;
}

function toMapEdge(edge: FlowEdge): MapEdge {
  const out: MapEdge = { id: edge.id, source: edge.source, target: edge.target };
  if (edge.sourceHandle) out.sourceHandle = edge.sourceHandle;
  if (edge.targetHandle) out.targetHandle = edge.targetHandle;
  if (edge.type) out.type = edge.type;
  if (typeof edge.label === 'string' && edge.label) out.label = edge.label;
  if (edge.animated) out.animated = true;
  return out;
}

export function toDoc(state: Pick<MapState, 'title' | 'nodes' | 'edges'>): MapDoc {
  return {
    version: MAP_VERSION,
    title: state.title,
    nodes: state.nodes.map(toMapNode),
    edges: state.edges.map(toMapEdge),
  };
}

/** Copies nodes with fresh ids, keeping only edges whose both ends were copied. */
export function cloneSubgraph(nodes: FlowNode[], edges: FlowEdge[], offset: number) {
  const ids = new Map(nodes.map((n) => [n.id, newId()]));
  const clonedNodes = nodes.map(
    (n) =>
      ({
        ...toMapNode(n),
        id: ids.get(n.id) as string,
        position: { x: n.position.x + offset, y: n.position.y + offset },
        data: structuredClone(n.data),
        selected: true,
      }) as FlowNode,
  );
  const clonedEdges = edges
    .filter((e) => ids.has(e.source) && ids.has(e.target))
    .map((e) => ({
      ...toMapEdge(e),
      id: newId(),
      source: ids.get(e.source) as string,
      target: ids.get(e.target) as string,
    }));
  return { nodes: clonedNodes, edges: clonedEdges };
}

/** Calls fn on the first call of a burst, then ignores calls until `ms` of quiet. */
function leadingDebounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    if (timer === undefined) fn(...args);
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
    }, ms);
  };
}

export const useMapStore = create<MapState>()(
  temporal(
    (set, get) => ({
      slug: null,
      title: '',
      nodes: [],
      edges: [],

      load: (slug, doc) => {
        // Paused so loading neither records a step nor swallows the first real edit in the debounce.
        const history = useMapStore.temporal.getState();
        history.pause();
        set({ slug, title: doc.title, nodes: doc.nodes as FlowNode[], edges: doc.edges });
        history.resume();
        history.clear();
      },

      setTitle: (title) => set({ title }),

      onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),

      onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),

      onConnect: (connection) =>
        set({ edges: addEdge({ ...connection, id: newId(), type: 'smoothstep' }, get().edges) }),

      addNode: (type, position, overrides = {}) => {
        const defaults = NODE_DEFAULTS[type];
        const id = newId();
        const node = {
          id,
          type,
          position,
          width: overrides.width ?? defaults.width,
          height: overrides.height ?? defaults.height,
          data: { ...defaults.data, ...overrides.data },
          selected: true,
        } as FlowNode;
        set({
          nodes: [...get().nodes.map((n) => (n.selected ? { ...n, selected: false } : n)), node],
        });
        return id;
      },

      updateNodeData: (id, patch) =>
        set({
          nodes: get().nodes.map((n) =>
            n.id === id ? ({ ...n, data: { ...n.data, ...patch } } as FlowNode) : n,
          ),
        }),

      updateEdge: (id, patch) =>
        set({ edges: get().edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) }),

      insertClones: (nodes, edges, offset) => {
        const clones = cloneSubgraph(nodes, edges, offset);
        set({
          nodes: [
            ...get().nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
            ...clones.nodes,
          ],
          edges: [...get().edges.map((e) => ({ ...e, selected: false })), ...clones.edges],
        });
      },
    }),
    {
      // History tracks only what gets saved, so selection and measuring never create undo steps.
      partialize: (state) => {
        const { title, nodes, edges } = toDoc(state);
        return { title, nodes: nodes as FlowNode[], edges: edges as FlowEdge[] };
      },
      equality: (a, b) => JSON.stringify(a) === JSON.stringify(b),
      // A drag or a burst of typing becomes one undo step.
      handleSet: (handleSet) => leadingDebounce(handleSet, 400),
      limit: 200,
    },
  ),
);

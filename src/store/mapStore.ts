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
import { type AddableNodeType, NODE_DEFAULTS } from './defaults';
import {
  CONNECTOR_STYLE_KEYS,
  type ConnectorStyle,
  MAP_VERSION,
  type MapDoc,
  type MapEdge,
  type MapNode,
  type NodeDataOf,
  type NodeType,
} from './schema';

export type FlowNode = { [T in NodeType]: Node<NodeDataOf<T>, T> }[NodeType];
export type FlowEdge = Edge & Omit<MapEdge, keyof Edge | 'label'> & Pick<MapEdge, 'type'>;

export interface MapState {
  slug: string | null;
  title: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** The look new connectors get on this canvas. */
  connector: ConnectorStyle;
  /** Where the canvas was last panned and zoomed to (saved; not an undo step). */
  viewport: MapDoc['viewport'];
  setViewport: (viewport: NonNullable<MapDoc['viewport']>) => void;
  load: (slug: string, doc: MapDoc) => void;
  setTitle: (title: string) => void;
  onNodesChange: (changes: NodeChange<FlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: <T extends AddableNodeType>(
    type: T,
    position: XYPosition,
    overrides?: { data?: Partial<NodeDataOf<T>>; width?: number; height?: number },
  ) => string;
  updateNodeData: <T extends NodeType>(id: string, patch: Partial<NodeDataOf<T>>) => void;
  updateEdge: (id: string, patch: Partial<Pick<FlowEdge, 'label'> & ConnectorStyle>) => void;
  /** Gives every connector, and every new one from now on, the look of connector `id`. */
  applyConnectorStyleToAll: (id: string) => void;
  insertClones: (nodes: FlowNode[], edges: FlowEdge[], offset: number) => void;
  /** Turns two or more image nodes into one stack node; returns its id. */
  stackImages: (ids: string[]) => string | null;
  /** Puts a stack's images (and their connectors) back where they were. */
  unstack: (id: string) => void;
}

export const newId = () => crypto.randomUUID().slice(0, 8);

const round = (n: number) => Math.round(n);

/** Space between images when a stack is spread back out. */
const UNSTACK_GAP = 24;

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
  if (edge.arrow && edge.arrow !== 'end') out.arrow = edge.arrow;
  if (edge.color) out.color = edge.color;
  if (edge.colorDark) out.colorDark = edge.colorDark;
  if (edge.width) out.width = edge.width;
  if (edge.labelSize) out.labelSize = edge.labelSize;
  return out;
}

/** The look of a connector: only the fields that are set. */
export function connectorStyleOf(edge: ConnectorStyle): ConnectorStyle {
  const out: Record<string, unknown> = {};
  for (const key of CONNECTOR_STYLE_KEYS) if (edge[key] !== undefined) out[key] = edge[key];
  return out as ConnectorStyle;
}

export function toDoc(
  state: Pick<MapState, 'title' | 'nodes' | 'edges'> &
    Partial<Pick<MapState, 'connector' | 'viewport'>>,
): MapDoc {
  const doc: MapDoc = {
    version: MAP_VERSION,
    title: state.title,
    nodes: state.nodes.map(toMapNode),
    edges: state.edges.map(toMapEdge),
  };
  const connector = connectorStyleOf(state.connector ?? {});
  if (Object.keys(connector).length) doc.connector = connector;
  if (state.viewport) doc.viewport = state.viewport;
  return doc;
}

/** Copies nodes with fresh ids, keeping only edges whose both ends were copied. */
/** A copied stack needs new ids for its images (and their connectors), or unstacking twice clashes. */
function cloneStackData(data: NodeDataOf<'stack'>): NodeDataOf<'stack'> {
  const ids = new Map(data.items.map((item) => [item.id, newId()]));
  const swap = (id: string) => ids.get(id) ?? id;
  return {
    items: data.items.map((item) => ({ ...item, id: swap(item.id) })),
    edges: data.edges.map((e) => ({
      ...e,
      id: newId(),
      source: swap(e.source),
      target: swap(e.target),
    })),
  };
}

export function cloneSubgraph(nodes: FlowNode[], edges: FlowEdge[], offset: number) {
  const ids = new Map(nodes.map((n) => [n.id, newId()]));
  const clonedNodes = nodes.map(
    (n) =>
      ({
        ...toMapNode(n),
        id: ids.get(n.id) as string,
        position: { x: n.position.x + offset, y: n.position.y + offset },
        data: n.type === 'stack' ? cloneStackData(n.data) : structuredClone(n.data),
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
      connector: {},
      viewport: undefined,

      load: (slug, doc) => {
        // Paused so loading neither records a step nor swallows the first real edit in the debounce.
        const history = useMapStore.temporal.getState();
        history.pause();
        set({
          slug,
          title: doc.title,
          nodes: doc.nodes as FlowNode[],
          edges: doc.edges,
          connector: doc.connector ?? {},
          viewport: doc.viewport,
        });
        history.resume();
        history.clear();
      },

      setTitle: (title) => set({ title }),

      setViewport: (viewport) => {
        const round = (n: number, places: number) => Number(n.toFixed(places));
        const next = {
          x: round(viewport.x, 1),
          y: round(viewport.y, 1),
          zoom: round(viewport.zoom, 4),
        };
        const prev = get().viewport;
        if (prev && prev.x === next.x && prev.y === next.y && prev.zoom === next.zoom) return;
        // Panning is not an edit: it never becomes an undo step.
        const history = useMapStore.temporal.getState();
        history.pause();
        set({ viewport: next });
        history.resume();
      },

      onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),

      onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),

      onConnect: (connection) =>
        set({
          edges: addEdge(
            { type: 'smoothstep', ...get().connector, ...connection, id: newId() },
            get().edges,
          ),
        }),

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
        // The new node becomes the only selection (connectors included), so the inspector shows it.
        set({
          nodes: [...get().nodes.map((n) => (n.selected ? { ...n, selected: false } : n)), node],
          edges: get().edges.map((e) => (e.selected ? { ...e, selected: false } : e)),
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

      applyConnectorStyleToAll: (id) => {
        const source = get().edges.find((e) => e.id === id);
        if (!source) return;
        const connector = connectorStyleOf(source);
        // Unset fields are cleared too, so every connector ends up looking exactly the same.
        const reset = Object.fromEntries(CONNECTOR_STYLE_KEYS.map((k) => [k, undefined]));
        set({
          connector,
          edges: get().edges.map((e) => ({ ...e, ...reset, ...connector })),
        });
      },

      stackImages: (ids) => {
        const { nodes, edges } = get();
        const chosen = new Set(ids);
        const images = nodes.filter(
          (n): n is Extract<FlowNode, { type: 'image' }> => n.type === 'image' && chosen.has(n.id),
        );
        if (images.length < 2) return null;
        const size = (n: FlowNode) => ({
          width: n.width ?? n.measured?.width ?? NODE_DEFAULTS.image.width ?? 0,
          height: n.height ?? n.measured?.height ?? NODE_DEFAULTS.image.height ?? 0,
        });
        // The pile takes the top image's size, centred on the images' bounding box.
        const boxes = images.map((n) => ({ ...n.position, ...size(n) }));
        const left = Math.min(...boxes.map((b) => b.x));
        const top = Math.min(...boxes.map((b) => b.y));
        const right = Math.max(...boxes.map((b) => b.x + b.width));
        const bottom = Math.max(...boxes.map((b) => b.y + b.height));
        const front = boxes[boxes.length - 1];
        const position = {
          x: round((left + right - front.width) / 2),
          y: round((top + bottom - front.height) / 2),
        };
        const id = newId();
        const imageIds = new Set(images.map((n) => n.id));
        const touched = edges.filter((e) => imageIds.has(e.source) || imageIds.has(e.target));
        // Connectors to the outside now attach to the stack; ones between the images are kept for later.
        const rerouted = touched
          .filter((e) => !(imageIds.has(e.source) && imageIds.has(e.target)))
          .map((e) => ({
            ...e,
            id: `${id}-${e.id}`,
            source: imageIds.has(e.source) ? id : e.source,
            target: imageIds.has(e.target) ? id : e.target,
            selected: false,
          }));
        const stack = {
          id,
          type: 'stack',
          position,
          width: round(front.width),
          height: round(front.height),
          selected: true,
          data: {
            items: images.map((n, i) => ({
              id: n.id,
              src: n.data.src,
              alt: n.data.alt,
              fit: n.data.fit,
              width: round(boxes[i].width),
              height: round(boxes[i].height),
            })),
            edges: touched.map(toMapEdge),
          },
        } as FlowNode;
        set({
          nodes: [
            ...nodes.filter((n) => !imageIds.has(n.id)).map((n) => ({ ...n, selected: false })),
            stack,
          ],
          edges: [...edges.filter((e) => !touched.includes(e)), ...rerouted],
        });
        return id;
      },

      unstack: (id) => {
        const { nodes, edges } = get();
        const stack = nodes.find((n) => n.id === id);
        if (stack?.type !== 'stack') return;
        // Laid out side by side from where the stack was; old positions aren't kept.
        let x = stack.position.x;
        const images = stack.data.items.map((item) => {
          const position = { x, y: stack.position.y };
          x += item.width + UNSTACK_GAP;
          return {
            id: item.id,
            type: 'image',
            position,
            width: item.width,
            height: item.height,
            data: { src: item.src, alt: item.alt, fit: item.fit },
            selected: true,
          } as FlowNode;
        });
        const rest = nodes.filter((n) => n.id !== id).map((n) => ({ ...n, selected: false }));
        const present = new Set([...rest, ...images].map((n) => n.id));
        const restored = stack.data.edges.filter(
          (e) => present.has(e.source) && present.has(e.target),
        );
        set({
          nodes: [...rest, ...images],
          edges: [...edges.filter((e) => e.source !== id && e.target !== id), ...restored],
        });
      },

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
        const { title, nodes, edges, connector } = toDoc(state);
        // A code block's highlighted HTML is derived from its code, so it never makes its own
        // undo step; after undo the node highlights itself again.
        const tracked = nodes.map((n) =>
          n.type === 'code' ? { ...n, data: { ...n.data, html: '' } } : n,
        );
        return {
          title,
          nodes: tracked as FlowNode[],
          edges: edges as FlowEdge[],
          connector: connector ?? {},
        };
      },
      equality: (a, b) => JSON.stringify(a) === JSON.stringify(b),
      // A drag or a burst of typing becomes one undo step.
      handleSet: (handleSet) => leadingDebounce(handleSet, 400),
      limit: 200,
    },
  ),
);

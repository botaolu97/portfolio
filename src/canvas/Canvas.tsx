import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  MarkerType,
  ReactFlow,
  SelectionMode,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  type DragEvent,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useShallow } from 'zustand/react/shallow';
import { SNAPSHOT } from '../app/snapshot';
import { EDITABLE } from '../content/api';
import { nodeTypes } from '../nodes/nodeTypes';
import type { AddableNodeType } from '../store/defaults';
import { type FlowEdge, type FlowNode, useMapStore } from '../store/mapStore';
import { useUiStore } from '../store/uiStore';
import { type Theme, useTheme } from '../ui/theme';
import { tokenValues } from '../ui/tokens';
import styles from './Canvas.module.css';
import { CanvasReveal } from './CanvasReveal';
import { addNodesFromFiles } from './fileDrop';
import { usePageZoomGuard } from './usePageZoomGuard';
import { useShortcuts } from './useShortcuts';
import { MAX_ZOOM, MIN_ZOOM } from './zoom';

// Edit-only; checked inline so the production build drops it.
const SelectionToolbar = import.meta.env.DEV
  ? lazy(() => import('../editor/SelectionToolbar'))
  : null;

export const PALETTE_MIME = 'application/x-mubu-node';

const defaultEdgeOptions = { type: 'smoothstep' };

/** The canvas dot grid: spacing and dot diameter in px at 100% zoom (CanvasReveal draws on it). */
const DOT_GAP = 24;
const DOT_SIZE = 3;
const DEFAULT_CONNECTOR_WIDTH = Number.parseFloat(tokenValues['component.connector.width']);
const DEFAULT_LABEL_SIZE = Number.parseFloat(tokenValues['component.connector.label-size']);

/**
 * Gives each connector its own color and thickness (or the --connector-* defaults). The arrow is
 * sized in screen units, growing gently with the line, so thick lines don't get giant arrows.
 */
function styleEdge(edge: FlowEdge, theme: Theme): FlowEdge {
  // Each theme has its own color; a connector with only a light color keeps it in dark too.
  const stroke =
    (theme === 'dark' ? (edge.colorDark ?? edge.color) : edge.color) ?? 'var(--connector-color)';
  const width = edge.width ?? DEFAULT_CONNECTOR_WIDTH;
  const size = 12 + width * 4;
  const marker = {
    type: MarkerType.ArrowClosed,
    color: stroke,
    width: size,
    height: size,
    markerUnits: 'userSpaceOnUse',
  };
  const arrow = edge.arrow ?? 'end';
  return {
    ...edge,
    style: { ...edge.style, stroke, strokeWidth: width },
    labelStyle: { ...edge.labelStyle, fontSize: edge.labelSize ?? DEFAULT_LABEL_SIZE },
    // React Flow sizes the label's background box only when the text changes, not the font size;
    // the label gets a canvas-colored outline instead (Canvas.module.css), which always fits.
    labelShowBg: false,
    // React Flow orients markers "auto-start-reverse", so a start arrow points at the source.
    markerEnd: arrow === 'end' || arrow === 'both' ? marker : undefined,
    markerStart: arrow === 'start' || arrow === 'both' ? marker : undefined,
  };
}

// View mode keeps selection (to show nodes could be edited) but drops every change that would edit.
const selectOnly = <C extends { type: string }>(changes: C[]) =>
  changes.filter((c) => c.type === 'select' || c.type === 'dimensions');

function ShortcutsHost({ onPasteImages }: { onPasteImages: (files: File[]) => void }) {
  useShortcuts(onPasteImages);
  return null;
}

export function Canvas({ onError }: { onError?: (message: string) => void }) {
  // The canvas opens where it was last left in the editor (read once); otherwise it fits everything.
  const [initialViewport] = useState(() => useMapStore.getState().viewport);
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode } = useMapStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
      onNodesChange: s.onNodesChange,
      onEdgesChange: s.onEdgesChange,
      onConnect: s.onConnect,
      addNode: s.addNode,
    })),
  );
  const { screenToFlowPosition } = useReactFlow<FlowNode, FlowEdge>();
  const theme = useTheme((s) => s.theme);
  const styledEdges = useMemo(() => edges.map((e) => styleEdge(e, theme)), [edges, theme]);
  usePageZoomGuard();
  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) =>
      onNodesChange(EDITABLE ? changes : selectOnly(changes)),
    [onNodesChange],
  );
  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) =>
      onEdgesChange(EDITABLE ? changes : selectOnly(changes)),
    [onEdgesChange],
  );
  const [dropping, setDropping] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  // Where the pointer last was over the canvas, so pasted images land under the cursor.
  const pointer = useRef<{ x: number; y: number } | null>(null);

  const onPasteImages = useCallback(
    (files: File[]) => {
      const box = root.current?.getBoundingClientRect();
      const at =
        pointer.current ??
        (box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : { x: 0, y: 0 });
      addNodesFromFiles(files, screenToFlowPosition(at)).catch((err: Error) =>
        onError?.(err.message),
      );
    },
    [screenToFlowPosition, onError],
  );

  // Presses inside a demo never reach this document, so this only tracks canvas gestures.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const down = () => el.classList.add(styles.pointerDown);
    const up = () => el.classList.remove(styles.pointerDown);
    el.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  const onDragOver = useCallback((e: DragEvent) => {
    if (!e.dataTransfer.types.includes('Files') && !e.dataTransfer.types.includes(PALETTE_MIME)) {
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDropping(e.dataTransfer.types.includes('Files'));
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDropping(false);
      const at = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const paletteType = e.dataTransfer.getData(PALETTE_MIME) as AddableNodeType;
      if (paletteType) {
        addNode(paletteType, at);
        return;
      }
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        addNodesFromFiles(files, at).catch((err: Error) => onError?.(err.message));
      }
    },
    [screenToFlowPosition, addNode, onError],
  );

  return (
    <div
      ref={root}
      className={`${styles.canvas} ${EDITABLE ? '' : styles.view} ${dropping ? styles.dropping : ''}`}
      onDragOver={EDITABLE ? onDragOver : undefined}
      onDragLeave={EDITABLE ? () => setDropping(false) : undefined}
      onDrop={EDITABLE ? onDrop : undefined}
      onPointerMove={
        EDITABLE ? (e) => (pointer.current = { x: e.clientX, y: e.clientY }) : undefined
      }
      onPointerLeave={EDITABLE ? () => (pointer.current = null) : undefined}
    >
      {EDITABLE && <ShortcutsHost onPasteImages={onPasteImages} />}
      <ReactFlow<FlowNode, FlowEdge>
        nodes={nodes}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={EDITABLE ? onConnect : undefined}
        onPaneClick={() => useUiStore.getState().setEditingText(null)}
        onNodeContextMenu={
          EDITABLE
            ? (e, node) => {
                if (node.type !== 'stack') return;
                e.preventDefault();
                useUiStore
                  .getState()
                  .setContextMenu({ nodeId: node.id, x: e.clientX, y: e.clientY });
              }
            : undefined
        }
        defaultEdgeOptions={defaultEdgeOptions}
        connectionMode={ConnectionMode.Loose}
        nodesDraggable={EDITABLE}
        nodesConnectable={EDITABLE}
        elementsSelectable
        edgesFocusable
        nodesFocusable
        deleteKeyCode={EDITABLE ? ['Backspace', 'Delete'] : null}
        // Figma-style: drag on empty canvas selects in edit mode; scroll pans, pinch / ⌘-scroll zooms.
        selectionOnDrag={EDITABLE}
        selectionMode={SelectionMode.Partial}
        // Shift isn't a box-select key (dragging empty canvas already box-selects in the editor), so
        // Shift is free for snapping handles; Shift- or ⌘-click adds to the selection.
        selectionKeyCode={null}
        multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
        panOnDrag={EDITABLE ? [1, 2] : true}
        panOnScroll
        zoomOnPinch
        snapToGrid={EDITABLE}
        snapGrid={[8, 8]}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        onlyRenderVisibleElements
        defaultViewport={initialViewport}
        fitView={!initialViewport}
        fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
        // The editor remembers the view, so the canvas (and its snapshot) open where you left off.
        onMoveEnd={
          EDITABLE && !SNAPSHOT
            ? (_, viewport) => useMapStore.getState().setViewport(viewport)
            : undefined
        }
        colorMode={theme}
        attributionPosition="bottom-center"
      >
        {SelectionToolbar && (
          <Suspense fallback={null}>
            <SelectionToolbar />
          </Suspense>
        )}
        <CanvasReveal gap={DOT_GAP} dotSize={DOT_SIZE} />
        <Background
          variant={BackgroundVariant.Dots}
          gap={DOT_GAP}
          size={DOT_SIZE}
          color="var(--color-canvas-dot)"
          // React Flow's dark mode paints its own near-black; the canvas color wins in both themes.
          bgColor="var(--color-canvas)"
        />
      </ReactFlow>
    </div>
  );
}

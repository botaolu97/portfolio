import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  SelectionMode,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { type DragEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { EDITABLE } from '../content/api';
import { nodeTypes } from '../nodes/nodeTypes';
import { type FlowEdge, type FlowNode, useMapStore } from '../store/mapStore';
import type { NodeType } from '../store/schema';
import { useUiStore } from '../store/uiStore';
import styles from './Canvas.module.css';
import { addNodesFromFiles } from './fileDrop';
import { useShortcuts } from './useShortcuts';

export const PALETTE_MIME = 'application/x-mubu-node';

const defaultEdgeOptions = {
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
  style: { strokeWidth: 1.5 },
};

const noop = () => {};

function ShortcutsHost() {
  useShortcuts();
  return null;
}

export function Canvas({ onError }: { onError?: (message: string) => void }) {
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
  const [dropping, setDropping] = useState(false);
  const root = useRef<HTMLDivElement>(null);

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
      const paletteType = e.dataTransfer.getData(PALETTE_MIME) as NodeType;
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
      className={`${styles.canvas} ${dropping ? styles.dropping : ''}`}
      onDragOver={EDITABLE ? onDragOver : undefined}
      onDragLeave={EDITABLE ? () => setDropping(false) : undefined}
      onDrop={EDITABLE ? onDrop : undefined}
    >
      {EDITABLE && <ShortcutsHost />}
      <ReactFlow<FlowNode, FlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={EDITABLE ? onNodesChange : undefined}
        onEdgesChange={EDITABLE ? onEdgesChange : undefined}
        onConnect={EDITABLE ? onConnect : undefined}
        onPaneClick={() => useUiStore.getState().setEditingText(null)}
        // React Flow disables pointer events on non-selectable nodes unless a click handler exists;
        // view mode still needs them for demos, links and video controls.
        onNodeClick={EDITABLE ? undefined : noop}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionMode={ConnectionMode.Loose}
        nodesDraggable={EDITABLE}
        nodesConnectable={EDITABLE}
        elementsSelectable={EDITABLE}
        edgesFocusable={EDITABLE}
        nodesFocusable={EDITABLE}
        deleteKeyCode={EDITABLE ? ['Backspace', 'Delete'] : null}
        // Figma-style: drag on empty canvas selects in edit mode; scroll pans, pinch / ⌘-scroll zooms.
        selectionOnDrag={EDITABLE}
        selectionMode={SelectionMode.Partial}
        panOnDrag={EDITABLE ? [1, 2] : true}
        panOnScroll
        zoomOnPinch
        snapToGrid={EDITABLE}
        snapGrid={[8, 8]}
        minZoom={0.05}
        maxZoom={4}
        onlyRenderVisibleElements
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
        colorMode="system"
        attributionPosition="bottom-center"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
          color="var(--canvas-dot)"
        />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap pannable zoomable position="bottom-right" nodeBorderRadius={4} />
      </ReactFlow>
    </div>
  );
}

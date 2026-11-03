import { Handle, NodeResizer, Position, useNodeId, useStore } from '@xyflow/react';
import { EDITABLE } from '../content/api';
import type { NodeType } from '../store/schema';
import styles from './nodes.module.css';

const SIDES = [
  { id: 't', position: Position.Top },
  { id: 'r', position: Position.Right },
  { id: 'b', position: Position.Bottom },
  { id: 'l', position: Position.Left },
];

const TYPE_LABELS: Record<NodeType, string> = {
  note: 'Note',
  text: 'Text',
  shape: 'Shape',
  image: 'Image',
  video: 'Video',
  demo: 'Demo',
};

const CORNERS = ['tl', 'tr', 'br', 'bl'] as const;

/**
 * Name-and-size tag above a selected node, kept at a constant screen size at any zoom. In view
 * mode it also draws corner handles: they only show that the node could be edited, and do nothing.
 */
function SelectionBadge() {
  const id = useNodeId();
  const info = useStore((s) => {
    const node = id ? s.nodeLookup.get(id) : undefined;
    if (!node) return '';
    const { width = 0, height = 0 } = node.measured;
    return `${TYPE_LABELS[node.type as NodeType] ?? 'Node'} · ${Math.round(width)} × ${Math.round(height)}`;
  });
  const inverse = useStore((s) => 1 / s.transform[2]);

  return (
    <>
      <span className={styles.badge} style={{ transform: `scale(${inverse})` }}>
        {info}
      </span>
      {!EDITABLE &&
        CORNERS.map((corner) => (
          <span
            key={corner}
            className={`${styles.corner} ${styles[corner]}`}
            style={{ transform: `translate(-50%, -50%) scale(${inverse})` }}
            aria-hidden="true"
          />
        ))}
    </>
  );
}

/** Connection handles on every side, a resizer while selected (edit mode), and the selection tag. */
export function NodeChrome({
  selected,
  minWidth = 40,
  minHeight = 30,
  keepAspectRatio,
}: {
  selected: boolean;
  minWidth?: number;
  minHeight?: number;
  keepAspectRatio?: boolean;
}) {
  const handleClass = `${styles.handle} ${EDITABLE ? styles.editable : ''}`;
  return (
    <>
      {EDITABLE && (
        <NodeResizer
          isVisible={selected}
          minWidth={minWidth}
          minHeight={minHeight}
          keepAspectRatio={keepAspectRatio}
          color="var(--color-accent)"
        />
      )}
      {selected && <SelectionBadge />}
      {SIDES.map((side) => (
        <Handle
          key={side.id}
          id={side.id}
          type="source"
          position={side.position}
          className={handleClass}
          isConnectable={EDITABLE}
        />
      ))}
    </>
  );
}

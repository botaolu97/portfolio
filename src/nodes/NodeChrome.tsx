import { Handle, NodeResizer, Position } from '@xyflow/react';
import { EDITABLE } from '../content/api';
import styles from './nodes.module.css';

const SIDES = [
  { id: 't', position: Position.Top },
  { id: 'r', position: Position.Right },
  { id: 'b', position: Position.Bottom },
  { id: 'l', position: Position.Left },
];

/** Connection handles on every side plus a resizer while selected (edit mode only). */
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
          color="var(--accent)"
        />
      )}
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

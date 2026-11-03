import type { NodeProps } from '@xyflow/react';
import { memo, useCallback, useState } from 'react';
import { asset, EDITABLE } from '../content/api';
import type { FlowNode } from '../store/mapStore';
import { NodeChrome } from './NodeChrome';
import styles from './nodes.module.css';
import { StackViewer } from './StackViewer';
import { layoutPrints } from './stackLayout';

/**
 * A pile of images, each print slightly tilted so you can tell there's more underneath.
 * Visitors click it to spread the images out; in the editor, double-click (right-click or the
 * inspector unstacks).
 */
export const StackNode = memo(function StackNode({
  data,
  selected,
  width = 320,
  height = 240,
}: NodeProps<Extract<FlowNode, { type: 'stack' }>>) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const prints = layoutPrints(data.items, width, height);

  return (
    <div
      className={styles.stack}
      onClick={EDITABLE ? undefined : () => setOpen(true)}
      onDoubleClick={EDITABLE ? () => setOpen(true) : undefined}
      onKeyDown={(e) => {
        if (e.key === 'Enter') setOpen(true);
      }}
      title={EDITABLE ? undefined : 'Click to spread out'}
    >
      <NodeChrome selected={selected} minWidth={120} minHeight={90} />
      {prints.map((p) => (
        <img
          key={p.item.id}
          className={styles.stackPrint}
          src={asset(p.item.src)}
          alt={p.item.alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          style={{
            left: p.left,
            top: p.top,
            width: p.width,
            height: p.height,
            transform: `translate(${p.dx}px, ${p.dy}px) rotate(${p.angle}deg)`,
          }}
        />
      ))}
      <span className={styles.stackCount}>{data.items.length}</span>
      {open && <StackViewer items={data.items} onClose={close} />}
    </div>
  );
});

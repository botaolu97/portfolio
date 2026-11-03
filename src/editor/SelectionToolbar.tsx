import { NodeToolbar, Position } from '@xyflow/react';
import { useShallow } from 'zustand/react/shallow';
import { useMapStore } from '../store/mapStore';
import styles from './Editor.module.css';

/** Floating toolbar above a selection of two or more images. For now its one action is Stack. */
export default function SelectionToolbar() {
  const imageIds = useMapStore(
    useShallow((s) => s.nodes.filter((n) => n.selected && n.type === 'image').map((n) => n.id)),
  );
  if (imageIds.length < 2) return null;
  return (
    <NodeToolbar nodeId={imageIds} isVisible position={Position.Top} offset={14}>
      <div className={styles.floatingToolbar} role="toolbar" aria-label="Selected images">
        <button
          type="button"
          className={styles.floatingButton}
          onClick={() => useMapStore.getState().stackImages(imageIds)}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <rect x="2.5" y="4.5" width="9" height="9" rx="1" fill="none" stroke="currentColor" />
            <path d="M5 2.5h8.5V11" fill="none" stroke="currentColor" />
          </svg>
          Stack {imageIds.length} images
        </button>
      </div>
    </NodeToolbar>
  );
}

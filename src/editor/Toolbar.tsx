import { useReactFlow } from '@xyflow/react';
import { useRef } from 'react';
import { Link } from 'wouter';
import { useStore } from 'zustand';
import top from '../app/TopBar.module.css';
import { addNodesFromFiles } from '../canvas/fileDrop';
import { useMapStore } from '../store/mapStore';
import { Button } from '../ui/Button';
import styles from './Editor.module.css';
import type { SaveStatus } from './useAutosave';

const STATUS_LABEL: Record<SaveStatus, string> = {
  saved: 'Saved',
  pending: 'Unsaved',
  saving: 'Saving…',
  error: 'Save failed',
};

export function useViewportCenter() {
  const { screenToFlowPosition } = useReactFlow();
  return () => screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
}

export function Toolbar({
  status,
  onError,
}: {
  status: SaveStatus;
  onError: (message: string) => void;
}) {
  const title = useMapStore((s) => s.title);
  const setTitle = useMapStore((s) => s.setTitle);
  const canUndo = useStore(useMapStore.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useMapStore.temporal, (s) => s.futureStates.length > 0);
  const center = useViewportCenter();
  const filesInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const onFiles = (list: FileList | null) => {
    if (!list?.length) return;
    addNodesFromFiles(Array.from(list), center()).catch((err: Error) => onError(err.message));
  };

  return (
    <header className={top.bar}>
      <Link href="/" className={top.back}>
        ← Maps
      </Link>
      <input
        className={top.title}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="Map title"
      />
      <span className={`${styles.status} ${status === 'error' ? styles.error : ''}`} role="status">
        {STATUS_LABEL[status]}
      </span>
      <span className={top.spacer} />
      <Button
        variant="ghost"
        disabled={!canUndo}
        onClick={() => useMapStore.temporal.getState().undo()}
        title="Undo (⌘Z)"
      >
        Undo
      </Button>
      <Button
        variant="ghost"
        disabled={!canRedo}
        onClick={() => useMapStore.temporal.getState().redo()}
        title="Redo (⇧⌘Z)"
      >
        Redo
      </Button>
      <span className={top.divider} />
      <Button onClick={() => filesInput.current?.click()} title="Images, videos, or HTML/CSS/JS">
        Upload files
      </Button>
      <Button onClick={() => folderInput.current?.click()} title="A folder becomes one demo">
        Upload demo folder
      </Button>
      <input
        ref={filesInput}
        type="file"
        multiple
        className={styles.hidden}
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={folderInput}
        type="file"
        className={styles.hidden}
        // @ts-expect-error webkitdirectory is supported by all evergreen browsers but not typed.
        webkitdirectory=""
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </header>
  );
}

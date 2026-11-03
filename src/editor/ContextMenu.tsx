import { useEffect, useRef } from 'react';
import { useMapStore } from '../store/mapStore';
import { useUiStore } from '../store/uiStore';
import styles from './Editor.module.css';

/** Right-click menu for nodes (edit mode). For now: Unstack on stacks. */
export function ContextMenu() {
  const menu = useUiStore((s) => s.contextMenu);
  const setMenu = useUiStore((s) => s.setContextMenu);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const close = (e: Event) => {
      if (
        e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)
      ) {
        setMenu(null);
      }
    };
    document.addEventListener('pointerdown', close, true);
    window.addEventListener('keydown', close, true);
    window.addEventListener('wheel', close, true);
    return () => {
      document.removeEventListener('pointerdown', close, true);
      window.removeEventListener('keydown', close, true);
      window.removeEventListener('wheel', close, true);
    };
  }, [menu, setMenu]);

  if (!menu) return null;
  return (
    <div
      ref={ref}
      className={`${styles.panel} ${styles.contextMenu}`}
      role="menu"
      aria-label="Stack"
      style={{ left: menu.x, top: menu.y }}
    >
      <button
        type="button"
        role="menuitem"
        className={styles.menuItem}
        onClick={() => {
          useMapStore.getState().unstack(menu.nodeId);
          setMenu(null);
        }}
      >
        Unstack
      </button>
    </div>
  );
}

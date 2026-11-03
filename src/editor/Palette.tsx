import { PALETTE_MIME } from '../canvas/Canvas';
import { NODE_DEFAULTS, PALETTE } from '../store/defaults';
import { useMapStore } from '../store/mapStore';
import styles from './Editor.module.css';
import { useViewportCenter } from './Toolbar';

const ICONS = { note: '▤', text: 'T', shape: '◇', image: '▣', video: '▶', demo: '</>' } as const;

/** Drag an item onto the canvas, or click to drop it in the middle of the view. */
export function Palette() {
  const addNode = useMapStore((s) => s.addNode);
  const center = useViewportCenter();

  return (
    <nav className={`${styles.panel} ${styles.palette}`} aria-label="Add to canvas">
      {PALETTE.map(({ type, label }) => (
        <button
          key={type}
          type="button"
          className={styles.paletteItem}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(PALETTE_MIME, type);
            e.dataTransfer.effectAllowed = 'copy';
          }}
          onClick={() => {
            const c = center();
            const { width, height } = NODE_DEFAULTS[type];
            addNode(type, { x: c.x - width / 2, y: c.y - height / 2 });
          }}
        >
          <span className={styles.paletteIcon}>{ICONS[type]}</span>
          {label}
        </button>
      ))}
    </nav>
  );
}
